#!/bin/sh
set -u
node --version
npm --version
result=0
./node_modules/.bin/tsc -b
code=$?; echo "TYPECHECK_EXIT=$code"; [ "$code" = 0 ] || result=1
npm run lint
code=$?; echo "LINT_EXIT=$code"; [ "$code" = 0 ] || result=1
npm test
code=$?; echo "UNIT_TESTS_EXIT=$code"; [ "$code" = 0 ] || result=1
npm run build
code=$?; echo "BUILD_EXIT=$code"; [ "$code" = 0 ] || result=1
exit "$result"
