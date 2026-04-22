#!/usr/bin/env python3
"""
Apply CORS configuration to Firebase Storage bucket
Run: python3 apply-cors.py
"""

import subprocess
import json
import sys

# Read the CORS configuration
with open('cors.json', 'r') as f:
    cors_config = json.load(f)

bucket_name = "gs://market-flow-7b074.firebasestorage.app"

print(f"🔧 Applying CORS configuration to {bucket_name}...")
print(f"📄 CORS Config: {json.dumps(cors_config, indent=2)}")

try:
    # Apply CORS using gsutil
    result = subprocess.run(
        ['gsutil', 'cors', 'set', 'cors.json', bucket_name],
        capture_output=True,
        text=True,
        check=True
    )
    print("✅ CORS configuration applied successfully!")
    print(result.stdout)
except FileNotFoundError:
    print("❌ gsutil not found!")
    print("\n📦 Please install Google Cloud SDK:")
    print("   https://cloud.google.com/sdk/docs/install")
    print("\n   Or run:")
    print("   curl https://sdk.cloud.google.com | bash")
    print("   exec -l $SHELL")
    print("   gcloud init")
    sys.exit(1)
except subprocess.CalledProcessError as e:
    print(f"❌ Failed to apply CORS: {e}")
    print(f"   Error: {e.stderr}")
    sys.exit(1)
