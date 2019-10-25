const esmRequire = require('esm')(module);
const parseIssue = esmRequire('./parseIssue').default;

test('parse', () => {
  expect(parseIssue('2015;7(3): 107-15')).toStrictEqual({
    year: 2015,
    volume: 7,
    issue: 3,
    pages: [107, 115]
  });
  expect(parseIssue('1998;20(4):1024')).toStrictEqual({
    year: 1998,
    volume: 20,
    issue: 4,
    pages: [1024, 1024]
  });
});