#!/usr/bin/env bash
# Fetch the Android libmpv prebuilt into the Android project's jniLibs (Linux/CI).
# Bash counterpart of fetch-libmpv-android.ps1 - see that file for the full
# rationale (jarnedemeulemeester v1.0.0, libplacebo dovi default-on, GPL binaries,
# DV needs hwdec=no). jniLibs/**/*.so is gitignored, so CI must run this before
# the Android build.
set -euo pipefail

VERSION="v1.0.0"
URL="https://github.com/jarnedemeulemeester/libmpv-android/releases/download/${VERSION}/libmpv-release.aar"
# arm64-v8a for real devices; x86_64 for the emulator (native, no arm64
# translation - the translated arm64 build's GLES calls fail on the emulated GPU).
ABIS=(arm64-v8a x86_64)
LIBS=(libmpv.so libavcodec.so libavdevice.so libavfilter.so libavformat.so \
      libavutil.so libswresample.so libswscale.so libc++_shared.so)

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
jnilibs="${repo_root}/apps/desktop/src-tauri/gen/android/app/src/main/jniLibs"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

echo "downloading ${URL}"
curl -fsSL "${URL}" -o "${tmp}/libmpv.aar"
unzip -q "${tmp}/libmpv.aar" -d "${tmp}/aar"

for abi in "${ABIS[@]}"; do
  mkdir -p "${jnilibs}/${abi}"
  for lib in "${LIBS[@]}"; do
    cp "${tmp}/aar/jni/${abi}/${lib}" "${jnilibs}/${abi}/"
    echo "  ${abi}/${lib}"
  done
done
echo "done: libmpv ${VERSION} staged into jniLibs"
