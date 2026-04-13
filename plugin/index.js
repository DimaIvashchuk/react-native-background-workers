/**
 * Babel plugin for react-native-background-workers.
 *
 * Automatically injects the 'worklet' directive into user-provided callback
 * functions so that react-native-worklets/plugin can workletize them.
 *
 * Must be listed BEFORE react-native-worklets/plugin in babel config:
 *
 *   plugins: [
 *     'react-native-background-workers/plugin',
 *     'react-native-worklets/plugin',
 *   ]
 */

const HOOK_NAMES = new Set(['useBackgroundWorker', 'useWorker']);
const WORKLETIZED_PROPERTIES = new Set(['setup', 'onMessage']);

function hasWorkletDirective(node) {
  const body = node.body;
  if (!body || body.type !== 'BlockStatement') return false;
  return body.directives?.some((d) => d.value?.value === 'worklet') ?? false;
}

function addWorkletDirective(t, node) {
  if (hasWorkletDirective(node)) return;

  // Convert concise arrow `(x) => expr` to block form `(x) => { return expr; }`
  if (node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement') {
    node.body = t.blockStatement([t.returnStatement(node.body)]);
    node.expression = false;
  }

  const body = node.body;
  if (!body || body.type !== 'BlockStatement') return;

  if (!body.directives) {
    body.directives = [];
  }

  body.directives.unshift(t.directive(t.directiveLiteral('worklet')));
}

function isFunctionNode(node) {
  return (
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

module.exports = function backgroundWorkersPlugin({ types: t }) {
  return {
    name: 'react-native-background-workers',
    visitor: {
      CallExpression(path) {
        const callee = path.node.callee;

        let calleeName = null;
        if (callee.type === 'Identifier') {
          calleeName = callee.name;
        } else if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier'
        ) {
          calleeName = callee.property.name;
        }

        if (!calleeName || !HOOK_NAMES.has(calleeName)) return;

        const args = path.node.arguments;
        if (!args || args.length === 0) return;

        if (calleeName === 'useWorker') {
          const taskArg = args[0];
          if (taskArg && isFunctionNode(taskArg)) {
            addWorkletDirective(t, taskArg);
          }
        }

        if (calleeName === 'useBackgroundWorker') {
          const optionsArg = args[0];
          if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;

          for (const prop of optionsArg.properties) {
            if (prop.type !== 'ObjectProperty' && prop.type !== 'Property')
              continue;

            const key = prop.key;
            const keyName =
              key.type === 'Identifier'
                ? key.name
                : key.type === 'StringLiteral'
                  ? key.value
                  : null;

            if (!keyName || !WORKLETIZED_PROPERTIES.has(keyName)) continue;

            if (isFunctionNode(prop.value)) {
              addWorkletDirective(t, prop.value);
            }
          }
        }
      },
    },
  };
};
