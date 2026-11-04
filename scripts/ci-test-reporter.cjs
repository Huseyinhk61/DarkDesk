const path = require('node:path');
const { inspect } = require('node:util');

// Keep a failed test's diagnostic available in the Actions annotations, including
// when the full job log requires signing in. Never print environment variables.
const escapeData = (value) =>
  String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const escapeProperty = (value) => escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');

module.exports = async function* reportFailures(events) {
  for await (const event of events) {
    if (event.type !== 'test:fail' || process.env.GITHUB_ACTIONS !== 'true') continue;
    const { name, file, line, column, details } = event.data;
    const error = details?.error?.cause || details?.error;
    const diagnostic = inspect(error, { depth: 3, colors: false, maxStringLength: 2000 });
    const properties = ['title=Failed test'];
    if (file) properties.push('file=' + escapeProperty(path.relative(process.cwd(), file)));
    if (Number.isInteger(line)) properties.push('line=' + line);
    if (Number.isInteger(column)) properties.push('col=' + column);
    yield `::error ${properties.join(',')}::${escapeData(`${name}\n${diagnostic}`.slice(0, 6000))}\n`;
  }
};
