using System;
using System.IO;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Threading;
using System.Threading.Tasks;
using Certes;
using Certes.Acme;
using Certes.Acme.Resource;
using HardwareBridge.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HardwareBridge.Services
{
    public interface ICertificateManager
    {
        Task<X509Certificate2> GetCertificateAsync();
        Task<bool> InitializeAsync();
        Task<bool> RenewCertificateAsync();
        bool IsCertificateValid();
    }

    public class CertificateManager : ICertificateManager
    {
        private readonly ILogger<CertificateManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly SemaphoreSlim _semaphore;
        private X509Certificate2 _currentCertificate;
        private Timer _renewalTimer;

        public CertificateManager(
            ILogger<CertificateManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _semaphore = new SemaphoreSlim(1, 1);
        }

        public async Task<bool> InitializeAsync()
        {
            try
            {
                _logger.LogInformation("Initializing certificate manager...");
                
                var config = _config.CurrentValue.Certificate;
                
                if (!config.UseLetsEncrypt)
                {
                    // Load existing certificate from file
                    return await LoadExistingCertificateAsync();
                }

                // Check if we have a valid certificate
                if (IsCertificateValid())
                {
                    _logger.LogInformation("Existing certificate is valid");
                    return true;
                }

                // Obtain new certificate
                var success = await ObtainCertificateAsync();
                
                if (success)
                {
                    // Schedule renewal
                    ScheduleRenewal();
                }

                return success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize certificate manager");
                return false;
            }
        }

        public async Task<X509Certificate2> GetCertificateAsync()
        {
            await _semaphore.WaitAsync();
            try
            {
                if (_currentCertificate == null || !IsCertificateValid())
                {
                    await InitializeAsync();
                }
                
                return _currentCertificate;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public bool IsCertificateValid()
        {
            if (_currentCertificate == null)
                return false;

            try
            {
                // Check if certificate is valid and not expiring soon
                var now = DateTime.UtcNow;
                var renewalThreshold = _config.CurrentValue.Certificate.RenewalThreshold;
                
                return _currentCertificate.NotBefore <= now && 
                       _currentCertificate.NotAfter > now.Add(renewalThreshold);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking certificate validity");
                return false;
            }
        }

        public async Task<bool> RenewCertificateAsync()
        {
            try
            {
                _logger.LogInformation("Renewing certificate...");
                
                var success = await ObtainCertificateAsync();
                
                if (success)
                {
                    _logger.LogInformation("Certificate renewed successfully");
                }
                else
                {
                    _logger.LogError("Failed to renew certificate");
                }

                return success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error renewing certificate");
                return false;
            }
        }

        private async Task<bool> LoadExistingCertificateAsync()
        {
            try
            {
                var certPath = Path.Combine(_config.CurrentValue.WebSocket.CertificatePath, "certificate.pfx");
                
                if (!File.Exists(certPath))
                {
                    _logger.LogWarning("Certificate file not found: {Path}", certPath);
                    return false;
                }

                _currentCertificate = new X509Certificate2(certPath);
                
                if (!IsCertificateValid())
                {
                    _logger.LogWarning("Loaded certificate is not valid");
                    return false;
                }

                _logger.LogInformation("Certificate loaded successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load existing certificate");
                return false;
            }
        }

        private async Task<bool> ObtainCertificateAsync()
        {
            var config = _config.CurrentValue.Certificate;
            
            try
            {
                _logger.LogInformation("Obtaining certificate from Let's Encrypt for domain: {Domain}", config.Domain);
                
                // Create ACME account
                var acme = new AcmeContext(WellKnownServers.LetsEncryptV2);
                var account = await acme.NewAccount(config.Email, true);
                
                // Create order
                var order = await acme.NewOrder(new[] { config.Domain });
                
                // Get authorization challenges
                var authz = await order.Authorizations();
                var challengeContext = await authz.First().Http();
                
                // Create certificate private key
                var privateKey = KeyFactory.NewKey(KeyAlgorithm.ES256);
                
                // Complete challenge (HTTP-01)
                var challenge = await challengeContext.Validate();
                
                // Wait for challenge to complete
                while (challenge.Status == ChallengeStatus.Pending || 
                       challenge.Status == ChallengeStatus.Processing)
                {
                    await Task.Delay(2000);
                    challenge = await challengeContext.Resource();
                }

                if (challenge.Status != ChallengeStatus.Valid)
                {
                    _logger.LogError("Challenge validation failed: {Status}", challenge.Status);
                    return false;
                }

                // Generate certificate
                var certChain = await order.Generate(new CsrInfo
                {
                    CommonName = config.Domain,
                }, privateKey);

                // Create PFX certificate
                var pfxBuilder = certChain.ToPfx(privateKey);
                var pfx = pfxBuilder.Build(config.Domain, config.Domain);
                
                _currentCertificate = new X509Certificate2(pfx, config.Domain, 
                    X509KeyStorageFlags.Exportable | X509KeyStorageFlags.PersistKeySet);

                // Save certificate to file
                await SaveCertificateAsync(_currentCertificate);
                
                _logger.LogInformation("Certificate obtained successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to obtain certificate from Let's Encrypt");
                return false;
            }
        }

        private async Task SaveCertificateAsync(X509Certificate2 certificate)
        {
            try
            {
                var certDir = _config.CurrentValue.WebSocket.CertificatePath;
                Directory.CreateDirectory(certDir);
                
                var certPath = Path.Combine(certDir, "certificate.pfx");
                var certBytes = certificate.Export(X509ContentType.Pfx, "certificate");
                
                await File.WriteAllBytesAsync(certPath, certBytes);
                
                // Also save as PEM for compatibility
                var pemPath = Path.Combine(certDir, "certificate.pem");
                var pemContent = PemEncoding.Write("CERTIFICATE", certificate.RawData);
                await File.WriteAllTextAsync(pemPath, pemContent);
                
                _logger.LogInformation("Certificate saved to {Path}", certPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save certificate");
            }
        }

        private void ScheduleRenewal()
        {
            try
            {
                var config = _config.CurrentValue.Certificate;
                
                if (_currentCertificate == null)
                    return;

                // Calculate renewal time (30 days before expiration)
                var renewalTime = _currentCertificate.NotAfter.Subtract(config.RenewalThreshold);
                var delay = renewalTime.Subtract(DateTime.UtcNow);
                
                if (delay.TotalMilliseconds <= 0)
                {
                    // Certificate is already due for renewal
                    _ = Task.Run(RenewCertificateAsync);
                    return;
                }

                // Cancel existing timer
                _renewalTimer?.Dispose();
                
                // Schedule renewal
                _renewalTimer = new Timer(async _ =>
                {
                    await RenewCertificateAsync();
                }, null, delay, Timeout.InfiniteTimeSpan);
                
                _logger.LogInformation("Certificate renewal scheduled for {RenewalTime}", renewalTime);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to schedule certificate renewal");
            }
        }

        public void Dispose()
        {
            _renewalTimer?.Dispose();
            _semaphore?.Dispose();
            _currentCertificate?.Dispose();
        }
    }
}