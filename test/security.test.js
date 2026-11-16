const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { ModelRegistry } = require('../build/core/model-registry');
const { BuildToolInputSchema, handleBuildTool } = require('../build/tools/build-tool');
const { ObjectToolInputSchema, handleObjectTool } = require('../build/tools/object-tool');
const { ExploreToolInputSchema, handleExploreTool } = require('../build/tools/explore-tool');

function createRegistry() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xpp-mcp-security-'));
  const descriptor = path.join(root, 'TestPackage', 'Descriptor', 'TestModel.xml');
  fs.mkdirSync(path.dirname(descriptor), { recursive: true });
  fs.writeFileSync(
    descriptor,
    '<ModelInfo><Name>TestModel</Name><ModelModule>TestPackage</ModelModule><Publisher>Test Publisher</Publisher></ModelInfo>',
  );
  const registry = new ModelRegistry(root);
  return registry.load().then(() => ({ root, registry }));
}

function objectDeps(registry) {
  return {
    registry,
    writer: {
      exists: () => false,
      readRaw: () => '',
      write: () => assert.fail('unexpected write'),
      writeObject: () => assert.fail('unexpected write'),
    },
    labels: { resolve: () => assert.fail('unexpected label write') },
  };
}

test('build model validation rejects path and shell metacharacters', async () => {
  assert.equal(BuildToolInputSchema.safeParse({ action: 'compile', model: 'MM' }).success, true);
  assert.equal(BuildToolInputSchema.safeParse({ action: 'compile', model: '../MM' }).success, false);
  assert.equal(BuildToolInputSchema.safeParse({ action: 'compile', model: 'MM & whoami' }).success, false);
});

test('build processes receive argv with shell disabled', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xpp-mcp-build-'));
  const originalSpawn = childProcess.spawn;
  let spawnCall;
  childProcess.spawn = (exe, args, options) => {
    spawnCall = { exe, args, options };
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    process.nextTick(() => child.emit('close', 0));
    return child;
  };

  try {
    await handleBuildTool(
      { action: 'compile', model: 'MM', incremental: false, verbose: false },
      { packagesRoot: root, binPath: path.join(root, 'bin') },
    );
    assert.ok(Array.isArray(spawnCall.args));
    assert.equal(spawnCall.options.shell, false);
    assert.ok(spawnCall.args.includes('-modelmodule=MM'));

    await assert.rejects(
      handleBuildTool(
        { action: 'compile', model: '../MM', incremental: false, verbose: false },
        { packagesRoot: root, binPath: path.join(root, 'bin') },
      ),
      /Invalid model name/,
    );
  } finally {
    childProcess.spawn = originalSpawn;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('model registry rejects unsafe object names and object types', async () => {
  const { root, registry } = await createRegistry();
  try {
    assert.equal(
      registry.getAotPath('TestModel', 'AxTable', 'SafeName'),
      path.join(root, 'TestPackage', 'TestModel', 'AxTable', 'SafeName.xml'),
    );
    assert.throws(() => registry.getAotPath('TestModel', 'AxTable', '../outside'), /Invalid object name/);
    assert.throws(() => registry.getAotPath('TestModel', '../outside', 'SafeName'), /Unsupported AOT object type/);
    assert.throws(() => registry.getModelPath('../TestModel'), /Invalid model name/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('model registry rejects AOT folders that resolve through a symlink outside the model', async (t) => {
  const { root, registry } = await createRegistry();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'xpp-mcp-outside-'));
  const modelRoot = path.join(root, 'TestPackage', 'TestModel');
  const linkedFolder = path.join(modelRoot, 'AxTable');
  try {
    fs.mkdirSync(modelRoot, { recursive: true });
    try {
      fs.symlinkSync(outside, linkedFolder, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        t.skip('directory symlinks are unavailable');
        return;
      }
      throw error;
    }
    assert.throws(() => registry.getAotPath('TestModel', 'AxTable', 'SafeName'), /outside the allowed root/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('object and explore operations reject traversal inputs before file access', async () => {
  const { root, registry } = await createRegistry();
  const deps = objectDeps(registry);
  try {
    for (const action of ['inspect', 'delete', 'edit']) {
      await assert.rejects(
        handleObjectTool({ action, model: 'TestModel', type: '../AxTable', name: 'SafeName' }, deps),
        /Unsupported object type/,
      );
    }
    await assert.rejects(
      handleObjectTool({ action: 'create', model: 'TestModel', type: 'AxTable', name: '../outside' }, deps),
      /Invalid object name/,
    );
    await assert.rejects(
      handleExploreTool({ action: 'list_objects', model: 'TestModel', type: '../AxTable' }, registry),
      /Unsupported AOT object type/,
    );
    await assert.rejects(
      handleExploreTool({ action: 'read', model: 'TestModel', type: 'AxTable', name: '../outside' }, registry),
      /Invalid object name/,
    );
    assert.equal(ObjectToolInputSchema.safeParse({ action: 'create', type: 'AxTable', name: '../outside' }).success, false);
    assert.equal(ObjectToolInputSchema.safeParse({ action: 'inspect', type: '../AxTable', name: 'SafeName' }).success, false);
    assert.equal(ExploreToolInputSchema.safeParse({ action: 'read', type: 'AxTable', name: '../outside' }).success, false);
    assert.equal(ExploreToolInputSchema.safeParse({ action: 'list_objects', type: '../AxTable' }).success, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
