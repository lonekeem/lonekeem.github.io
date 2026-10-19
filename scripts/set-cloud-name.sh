#!/usr/bin/env bash
# Usage: scripts/set-cloud-name.sh <cloud_name>
# Sets the Cloudinary cloud name in js/media-config.js and firestore.rules (the two places it lives).
# Then deploy rules: firebase deploy --only firestore:rules
set -euo pipefail
cd "$(dirname "$0")/.."
name="${1:?usage: $0 <cloud_name>}"
[[ "$name" =~ ^[a-z0-9_-]{1,64}$ ]] || { echo "Cloud names are lowercase letters, digits, - or _"; exit 1; }
cur_rules=$(sed -nE "s/.*function cloudinaryCloud\(\) \{ return '([^']*)'; \}.*/\1/p" firestore.rules)
sed -i -E "s|^(  cloudName: )'[^']*',.*$|\1'$name', // Cloudinary cloud name (public)|" js/media-config.js
sed -i "s/function cloudinaryCloud() { return '$cur_rules'; }/function cloudinaryCloud() { return '$name'; }/" firestore.rules
grep -n "cloudName:" js/media-config.js
grep -n "function cloudinaryCloud" firestore.rules
