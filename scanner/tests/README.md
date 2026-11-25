# Scanner tests

This folder contains Scanner test groups and one-test case modules.

Running Scanner with `--types test` writes or refreshes a `<testfile>.flow.json`
beside each discovered `.case.ts` file. Each flow records the test callback's
statically resolved calls; recursive calls point to the first node's route so
the flow stays finite. Run `npm run test:flows --workspace=codaigram-scanner`
to verify generation and refresh behavior.
