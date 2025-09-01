// src/infrastructure/security/SecurityHeaders.js
class SecurityHeaders {
  static getSecureHeaders() {
    return {
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // Enable XSS protection
      'X-XSS-Protection': '1; mode=block',
      
      // Strict transport security (HTTPS only)
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      
      // Content Security Policy
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
      
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Permissions policy
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      
      // Cache control for sensitive endpoints
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache'
    };
  }

  static getMiddleware() {
    return (req, res, next) => {
      const headers = this.getSecureHeaders();
      
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      next();
    };
  }
}