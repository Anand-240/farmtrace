#!/bin/sh
set -eu

cat > /usr/share/nginx/html/runtime-env.js <<EOF
window.__FARMTRACE_CONFIG__ = {
  REACT_APP_API_URL: "${REACT_APP_API_URL:-/api}",
  REACT_APP_RAZORPAY_KEY_ID: "${REACT_APP_RAZORPAY_KEY_ID:-}"
};
EOF

exec nginx -g 'daemon off;'