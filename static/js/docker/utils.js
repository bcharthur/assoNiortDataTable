// static/js/utils.js

// Formate en GB décimal (MB/GB base 10)
export function formatBytesMBGB(bytes) {
  const GB = 1_000_000_000;
  const MB = 1_000_000;
  if (bytes >= GB) return (bytes / GB).toFixed(2) + ' GB';
  return (bytes / MB).toFixed(2) + ' MB';
}

// Formate en GiB (base 2)
export function formatBytesBinary(bytes) {
  const GiB = 1024 ** 3;
  const MiB = 1024 ** 2;
  if (bytes >= GiB) return (bytes / GiB).toFixed(2) + ' GiB';
  return (bytes / MiB).toFixed(2) + ' MiB';
}
