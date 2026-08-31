// One-off, sandbox-only compile helper: this sandbox's network egress blocks
// binaries.soliditylang.org, so `hardhat compile`'s built-in downloader can't fetch
// solc. This script compiles with the already-npm-installed, self-contained `solc`
// JS/WASM package instead and writes Hardhat-shaped artifacts, so `hardhat test
// --no-compile` can run without any network access. Not part of the normal build —
// a real dev/CI environment with open egress just runs `hardhat compile` directly.
const fs = require('node:fs');
const path = require('node:path');
const solc = require('solc');

const root = path.resolve(__dirname, '..');
const contractsDir = path.join(root, 'contracts');
const artifactsDir = path.join(root, 'artifacts');

function findImports(importPath) {
  const candidates = [
    path.join(root, 'node_modules', importPath),
    path.join(root, '..', '..', 'node_modules', importPath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, 'utf8') };
    }
  }
  return { error: `File not found: ${importPath}` };
}

const sources = {};
for (const file of fs.readdirSync(contractsDir)) {
  if (!file.endsWith('.sol')) continue;
  sources[`contracts/${file}`] = {
    content: fs.readFileSync(path.join(contractsDir, file), 'utf8'),
  };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
for (const e of output.errors ?? []) console.error(e.formattedMessage);
if (errors.length > 0) {
  console.error(`\n${errors.length} compile error(s).`);
  process.exit(1);
}

for (const [file, contracts] of Object.entries(output.contracts)) {
  for (const [name, artifact] of Object.entries(contracts)) {
    const outDir = path.join(artifactsDir, file);
    fs.mkdirSync(outDir, { recursive: true });
    const hardhatArtifact = {
      _format: 'hh-sol-artifact-1',
      contractName: name,
      sourceName: file,
      abi: artifact.abi,
      bytecode: '0x' + artifact.evm.bytecode.object,
      deployedBytecode: '0x' + artifact.evm.deployedBytecode.object,
      linkReferences: {},
      deployedLinkReferences: {},
    };
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify(hardhatArtifact, null, 2),
    );
    fs.writeFileSync(path.join(outDir, `${name}.dbg.json`), JSON.stringify({
      _format: 'hh-sol-dbg-1',
      buildInfo: '../../build-info/local.json',
    }, null, 2));
  }
}

console.log(`Compiled ${Object.keys(sources).length} source file(s) with solc ${solc.version()} — artifacts written to ${artifactsDir}`);
