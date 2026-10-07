const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function between(source, start, end){
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `missing ${start}`);
  return source.slice(from, to);
}

test('Arabic building labels use Arabic first and Hebrew in parentheses', () => {
  const helpers = between(
    index,
    'const BUILDING_NAMES_RU',
    'function updateRestSpaceServiceButton'
  );
  const context = vm.createContext({
    lang:'ar',
    CAMPUS_DATA:{
      buildings:[{name:'Main Building', name_he:'בניין ראשי'}],
      points:{food:[], shops:[]}
    }
  });
  vm.runInContext(helpers, context);

  assert.equal(
    vm.runInContext(
      "localizedBuildingName(CAMPUS_DATA.buildings[0])",
      context
    ),
    'المبنى الرئيسي (בניין ראשי)'
  );
  assert.equal(
    vm.runInContext('secondaryBuildingName(CAMPUS_DATA.buildings[0])', context),
    ''
  );
  assert.equal(
    vm.runInContext(
      "localizedBuildingNameByEnglishName('Carmel Gate (South gate)')",
      context
    ),
    'بوابة الكرمل (שער כרמל)'
  );
});
