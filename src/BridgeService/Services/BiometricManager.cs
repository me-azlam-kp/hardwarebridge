using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HardwareBridge.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HardwareBridge.Services
{
    public interface IBiometricManager
    {
        Task<BiometricEnrollResult> EnrollAsync(string deviceId, string userId, string userName, string biometricData);
        Task<BiometricVerifyResult> AuthenticateAsync(string deviceId, string userId, string biometricData);
        Task<BiometricIdentifyResult> IdentifyAsync(string deviceId, string biometricData);
        Task<BiometricDeviceStatus> GetStatusAsync(string deviceId);
        Task<List<BiometricUser>> GetUsersAsync(string deviceId);
        Task<BiometricDeleteResult> DeleteUserAsync(string deviceId, string userId);
        Task<List<DeviceInfo>> DiscoverBiometricDevicesAsync();
    }

    public class BiometricManager : IBiometricManager
    {
        private readonly ILogger<BiometricManager> _logger;
        private readonly IOptionsMonitor<ServiceConfiguration> _config;
        private readonly ConcurrentDictionary<string, List<BiometricUser>> _enrolledUsers;

        public BiometricManager(
            ILogger<BiometricManager> logger,
            IOptionsMonitor<ServiceConfiguration> config)
        {
            _logger = logger;
            _config = config;
            _enrolledUsers = new ConcurrentDictionary<string, List<BiometricUser>>();
        }

        public async Task<BiometricEnrollResult> EnrollAsync(string deviceId, string userId, string userName, string biometricData)
        {
            try
            {
                if (string.IsNullOrEmpty(biometricData))
                {
                    return new BiometricEnrollResult
                    {
                        Success = false,
                        Error = "Biometric data is required"
                    };
                }

                var users = _enrolledUsers.GetOrAdd(deviceId, _ => new List<BiometricUser>());

                // Check if user already exists
                var existingUser = users.FirstOrDefault(u => u.UserId == userId);
                if (existingUser != null)
                {
                    // Update existing enrollment
                    existingUser.UserName = userName;
                    existingUser.BiometricTemplate = biometricData;
                    existingUser.UpdatedAt = DateTime.UtcNow;

                    _logger.LogInformation("Updated biometric enrollment for user {UserId} on device {DeviceId}", userId, deviceId);
                }
                else
                {
                    users.Add(new BiometricUser
                    {
                        UserId = userId,
                        UserName = userName,
                        BiometricTemplate = biometricData,
                        EnrolledAt = DateTime.UtcNow,
                        DeviceId = deviceId
                    });

                    _logger.LogInformation("Enrolled user {UserId} on device {DeviceId}", userId, deviceId);
                }

                return new BiometricEnrollResult
                {
                    Success = true,
                    UserId = userId,
                    DeviceId = deviceId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enrolling user {UserId} on device {DeviceId}", userId, deviceId);
                return new BiometricEnrollResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<BiometricVerifyResult> AuthenticateAsync(string deviceId, string userId, string biometricData)
        {
            try
            {
                if (!_enrolledUsers.TryGetValue(deviceId, out var users))
                {
                    return new BiometricVerifyResult
                    {
                        Success = false,
                        Verified = false,
                        Error = "No users enrolled on this device"
                    };
                }

                var user = users.FirstOrDefault(u => u.UserId == userId);
                if (user == null)
                {
                    return new BiometricVerifyResult
                    {
                        Success = true,
                        Verified = false,
                        UserId = userId,
                        Confidence = 0
                    };
                }

                // Compare biometric templates
                var confidence = ComputeMatchConfidence(user.BiometricTemplate, biometricData);
                var verified = confidence >= 0.7; // 70% threshold

                _logger.LogInformation("Biometric verification for user {UserId}: verified={Verified}, confidence={Confidence}",
                    userId, verified, confidence);

                return new BiometricVerifyResult
                {
                    Success = true,
                    Verified = verified,
                    UserId = userId,
                    Confidence = confidence
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying user {UserId} on device {DeviceId}", userId, deviceId);
                return new BiometricVerifyResult
                {
                    Success = false,
                    Verified = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<BiometricIdentifyResult> IdentifyAsync(string deviceId, string biometricData)
        {
            try
            {
                if (!_enrolledUsers.TryGetValue(deviceId, out var users) || users.Count == 0)
                {
                    return new BiometricIdentifyResult
                    {
                        Success = true,
                        Identified = false,
                        Error = "No users enrolled on this device"
                    };
                }

                BiometricUser bestMatch = null;
                double bestConfidence = 0;

                foreach (var user in users)
                {
                    var confidence = ComputeMatchConfidence(user.BiometricTemplate, biometricData);
                    if (confidence > bestConfidence)
                    {
                        bestConfidence = confidence;
                        bestMatch = user;
                    }
                }

                var identified = bestConfidence >= 0.7;

                _logger.LogInformation("Biometric identification on device {DeviceId}: identified={Identified}, confidence={Confidence}",
                    deviceId, identified, bestConfidence);

                return new BiometricIdentifyResult
                {
                    Success = true,
                    Identified = identified,
                    UserId = identified ? bestMatch?.UserId : null,
                    UserName = identified ? bestMatch?.UserName : null,
                    Confidence = bestConfidence
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error identifying biometric on device {DeviceId}", deviceId);
                return new BiometricIdentifyResult
                {
                    Success = false,
                    Identified = false,
                    Error = ex.Message
                };
            }
        }

        public Task<BiometricDeviceStatus> GetStatusAsync(string deviceId)
        {
            var userCount = 0;
            if (_enrolledUsers.TryGetValue(deviceId, out var users))
            {
                userCount = users.Count;
            }

            var status = new BiometricDeviceStatus
            {
                DeviceId = deviceId,
                Status = "available",
                EnrolledUsers = userCount,
                MaxUsers = 1000,
                SupportedModes = new[] { "verify", "identify", "enroll" },
                Timestamp = DateTime.UtcNow
            };

            return Task.FromResult(status);
        }

        public Task<List<BiometricUser>> GetUsersAsync(string deviceId)
        {
            if (_enrolledUsers.TryGetValue(deviceId, out var users))
            {
                // Return users without biometric template data for security
                var safeUsers = users.Select(u => new BiometricUser
                {
                    UserId = u.UserId,
                    UserName = u.UserName,
                    DeviceId = u.DeviceId,
                    EnrolledAt = u.EnrolledAt,
                    UpdatedAt = u.UpdatedAt
                }).ToList();

                return Task.FromResult(safeUsers);
            }

            return Task.FromResult(new List<BiometricUser>());
        }

        public Task<BiometricDeleteResult> DeleteUserAsync(string deviceId, string userId)
        {
            try
            {
                if (!_enrolledUsers.TryGetValue(deviceId, out var users))
                {
                    return Task.FromResult(new BiometricDeleteResult
                    {
                        Success = false,
                        Error = "No users enrolled on this device"
                    });
                }

                var user = users.FirstOrDefault(u => u.UserId == userId);
                if (user == null)
                {
                    return Task.FromResult(new BiometricDeleteResult
                    {
                        Success = false,
                        Error = "User not found"
                    });
                }

                users.Remove(user);
                _logger.LogInformation("Deleted biometric user {UserId} from device {DeviceId}", userId, deviceId);

                return Task.FromResult(new BiometricDeleteResult
                {
                    Success = true,
                    UserId = userId,
                    DeviceId = deviceId
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user {UserId} from device {DeviceId}", userId, deviceId);
                return Task.FromResult(new BiometricDeleteResult
                {
                    Success = false,
                    Error = ex.Message
                });
            }
        }

        public Task<List<DeviceInfo>> DiscoverBiometricDevicesAsync()
        {
            // Biometric devices are typically discovered via network scanning on port 4370
            // or through USB enumeration. For now, return devices that have enrolled users.
            var devices = _enrolledUsers.Keys.Select(deviceId => new DeviceInfo
            {
                Id = deviceId,
                Name = $"Biometric Device ({deviceId})",
                Type = "biometric",
                Status = "available",
                IsConnected = true,
                LastSeen = DateTime.UtcNow
            }).ToList();

            return Task.FromResult(devices);
        }

        private double ComputeMatchConfidence(string template1, string template2)
        {
            if (string.IsNullOrEmpty(template1) || string.IsNullOrEmpty(template2))
                return 0;

            if (template1 == template2)
                return 1.0;

            // Simple similarity comparison for template matching
            // In production, this would use actual biometric matching algorithms
            var maxLen = Math.Max(template1.Length, template2.Length);
            if (maxLen == 0) return 0;

            var commonLen = Math.Min(template1.Length, template2.Length);
            var matches = 0;

            for (int i = 0; i < commonLen; i++)
            {
                if (template1[i] == template2[i])
                    matches++;
            }

            return (double)matches / maxLen;
        }
    }

    public class BiometricUser
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public string DeviceId { get; set; }
        public string BiometricTemplate { get; set; }
        public DateTime EnrolledAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class BiometricEnrollResult
    {
        public bool Success { get; set; }
        public string UserId { get; set; }
        public string DeviceId { get; set; }
        public string Error { get; set; }
    }

    public class BiometricVerifyResult
    {
        public bool Success { get; set; }
        public bool Verified { get; set; }
        public string UserId { get; set; }
        public double Confidence { get; set; }
        public string Error { get; set; }
    }

    public class BiometricIdentifyResult
    {
        public bool Success { get; set; }
        public bool Identified { get; set; }
        public string UserId { get; set; }
        public string UserName { get; set; }
        public double Confidence { get; set; }
        public string Error { get; set; }
    }

    public class BiometricDeviceStatus
    {
        public string DeviceId { get; set; }
        public string Status { get; set; }
        public int EnrolledUsers { get; set; }
        public int MaxUsers { get; set; }
        public string[] SupportedModes { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class BiometricDeleteResult
    {
        public bool Success { get; set; }
        public string UserId { get; set; }
        public string DeviceId { get; set; }
        public string Error { get; set; }
    }
}
