# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

We take the security of Haro seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do NOT report security vulnerabilities through public GitHub issues.**

### How to Report a Security Vulnerability

If you think you have found a vulnerability in Haro, please email [maintainer email]. Include as much detail as possible to help us identify and fix the issue quickly.

### What to Include in Your Report

- A description of the vulnerability
- Steps to reproduce the issue
- A proof of concept (if possible)
- Any potential impact
- Your suggested fix (if you have one)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Updates**: We will keep you informed of our progress
- **Timeline**: We aim to resolve critical issues within 7 days
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

### Security Best Practices

When using Haro, please follow these security best practices:

1. **Keep Haro Updated**: Always use the latest version to benefit from security patches
2. **Validate Input**: Always validate and sanitize data before storing it in Haro
3. **Use Immutable Mode**: Enable immutable mode to prevent accidental data modification
4. **Limit Access**: Control access to your Haro instances through proper authentication
5. **Monitor Logs**: Watch for unusual patterns in data access

### Security Considerations

Haro is an in-memory data store. Consider the following when deploying:

- **Data Persistence**: Haro does not persist data to disk. Ensure proper backup strategies
- **Memory Limits**: Be aware of memory consumption with large datasets
- **Access Control**: Implement proper access control at the application level
- **Network Exposure**: Do not expose Haro instances directly to untrusted networks

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.1 -> 1.0.2) and will be announced in the changelog and GitHub releases.

## Recognition

We appreciate responsible disclosure and would like to thank the following security researchers for their contributions:

- [Name/Handle] - [Date] - [Vulnerability type]

*This security policy is adapted from best practices for open source projects.*
