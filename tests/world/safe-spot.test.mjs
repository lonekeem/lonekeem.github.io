import assert from 'node:assert/strict';
import { HOUSES, FLAT } from '../../js/world/layout.js';
import { doorSpot, houseShell, insideShell, positionBad, standY } from '../../js/world/safe-spot.js';
import { healItems, placedItems, defaultItems, parseItems } from '../../js/world/interior.js';

const bluff = HOUSES.find((h) => h.id === 'h484');
assert.equal(bluff.spot, '⛰️ Bubble Bluff');
assert.equal(bluff.estate, 1);

const door = doorSpot(bluff);
assert.equal(positionBad(door.x, door.z), false, 'the new front walk is a safe place to stand');
assert.equal(insideShell(bluff, door.x, door.z), false, 'the player stands outside the porch');

const shell = houseShell(bluff);
const camZ = door.z - 8;
assert.ok(door.z - bluff.z > shell.front, 'the sidewalk is past the porch');
assert.equal(insideShell(bluff, door.x, camZ), false, 'a camera 8 m toward the house still stays outside the mesh');

const oldZ = bluff.z + bluff.d / 2 + 3.2;
assert.equal(insideShell(bluff, bluff.x, oldZ), true, 'the old front-door point sits under the porch');
assert.equal(positionBad(bluff.x, oldZ), true, 'that old point is never restored');

assert.equal(positionBad(NaN, 10), true);
assert.equal(positionBad(460, 580), true, 'an interior cell is not an outdoor spawn');
assert.equal(standY(1, door.x, door.z), FLAT, 'a low yard height is lifted to the lawn');
assert.equal(standY(FLAT + 1, door.x, door.z), FLAT + 1, 'a hill stays a hill');

const city = HOUSES.find((h) => h.w === 9 && h.face > 0);
const cityDoor = doorSpot(city);
assert.equal(positionBad(cityDoor.x, cityDoor.z), false, 'a city sidewalk is outside that house');

const heal = healItems('zz,0,0;nope;cs,11,0,0;ar,12,-4,3;bs,-11,6,1', true);
assert.equal(heal.changed, true);
assert.equal(heal.items.some((it) => it.c === 'zz' || it.c === 'nope'), false);
const sofa = heal.items.find((it) => it.c === 'cs');
assert.ok(sofa.x <= 3.9, 'a sofa that crossed the wall is pulled back in');
assert.equal(heal.items.find((it) => it.c === 'ar').x, 6, 'wall art on the wall is left alone');
const shelf = heal.items.find((it) => it.c === 'bs');
assert.equal(shelf.x, -5.5);
assert.equal(shelf.z, 3);

const starters = parseItems(defaultItems(true, 0));
const packed = healItems(defaultItems(true, 0), true);
assert.equal(packed.changed, false, 'the furniture that comes with a house is not rewritten');
assert.equal(placedItems({ items: '' }, { seed: 0 }, true).length, 0);
assert.equal(placedItems({}, { seed: 0 }, true).some((it) => it.c === 'ar' && it.x === 6), true);
assert.equal(starters.filter((it) => it.c === 'bk' && it.f === 1).length, 1);

console.log('safe-spot tests ok');
