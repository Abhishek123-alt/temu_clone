---
name: payment-integration
description: Integrate payment gateways with high security and reliability.
metadata:
  type: professional-standard
---

# Payment Integration Standard
- Use Stripe PaymentIntents for secure checkout.
- Implement robust webhook handlers with signature verification.
- Ensure all payment operations are idempotent using unique request keys.
- Handle 3D Secure and other SCA requirements.
- Log all payment attempts and failures for audit trails.
- Never store raw card data on local servers (PCI compliance).
