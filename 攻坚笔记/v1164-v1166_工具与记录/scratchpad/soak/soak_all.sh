#!/bin/bash
# Runs every profile once (sequentially, one process at a time), no shrinking; logs + report.json per profile.
# usage: soak_all.sh <repoDir> [outDir] [profiles...]
# Stop it with:  kill $(cat <outDir>/soak.pid) $(cat <outDir>/child.pid)      (pid files; never pkill -f)
cd "$(dirname "$0")"
REPO="$1"; OUT="${2:-out}"; shift 2
PROFILES="${*:-clean ci lag faults skew ladder adversary disrupt chaos sweep}"
mkdir -p "$OUT"
echo $$ > "$OUT/soak.pid"
for p in $PROFILES; do
  echo "=== $p $(date +%T)" >> "$OUT/progress.txt"
  node fuzz.mjs "$REPO" --profile "$p" --no-shrink --quiet --out "$OUT/$p" > "$OUT/$p.log" 2>&1 &
  echo $! > "$OUT/child.pid"
  wait $!
  echo "    rc=$? $(tail -1 "$OUT/$p.log")" >> "$OUT/progress.txt"
done
echo "=== done $(date +%T)" >> "$OUT/progress.txt"
rm -f "$OUT/child.pid" "$OUT/soak.pid"
