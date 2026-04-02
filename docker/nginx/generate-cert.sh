#!/bin/bash
# Generate self-signed certificate for not-replaced-yet.com domain

set -e

CERT_DIR="docker/nginx/certs"
DOMAIN="not-replaced-yet.com"
DAYS=365

# Create cert directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Check if certificate already exists
if [ -f "$CERT_DIR/$DOMAIN.crt" ] && [ -f "$CERT_DIR/$DOMAIN.key" ]; then
    echo "✅ Certificate already exists at $CERT_DIR/$DOMAIN.crt"
    echo "If you want to regenerate, delete the cert directory first:"
    echo "  rm -rf $CERT_DIR"
    exit 0
fi

echo "🔒 Generating self-signed certificate for $DOMAIN..."
echo "   Valid for $DAYS days"
echo ""

# Generate private key and certificate in one command
openssl req -x509 -newkey rsa:2048 -keyout "$CERT_DIR/$DOMAIN.key" -out "$CERT_DIR/$DOMAIN.crt" \
    -days "$DAYS" -nodes \
    -subj "/C=CN/ST=State/L=City/O=Organization/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:*.$DOMAIN"

# Fix permissions
chmod 644 "$CERT_DIR/$DOMAIN.crt"
chmod 600 "$CERT_DIR/$DOMAIN.key"

echo ""
echo "✅ Certificate generated successfully!"
echo ""
echo "📍 Location:"
echo "   Certificate: $CERT_DIR/$DOMAIN.crt"
echo "   Private Key: $CERT_DIR/$DOMAIN.key"
echo ""
echo "⚠️  Self-signed certificate warning:"
echo "   - Browsers will show security warning (normal for self-signed)"
echo "   - Mobile apps may reject self-signed certs (need to add to trust store)"
echo "   - Use Let's Encrypt for production"
echo ""
echo "🚀 Next steps:"
echo "   1. Update your /etc/hosts or DNS to point:"
echo "      - web.not-replaced-yet.com -> Lightsail IP"
echo "      - admin.not-replaced-yet.com -> Lightsail IP"
echo "      - api.not-replaced-yet.com -> Lightsail IP"
echo ""
echo "   2. Start containers:"
echo "      docker compose --env-file docker/.env.staging up -d --build"
echo ""
echo "   3. Test HTTPS:"
echo "      curl -k https://api.not-replaced-yet.com/health"
echo ""
