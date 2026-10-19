// Bonus world: Candy Falls (secret). Unlocked with Big Stars. New: gumball poppers (stomp the gumballs!) plus belts and gummy mushrooms.
import { L } from '../lib.mjs';
export default function (levels) {
levels.push(L('B-1', 'Gumdrop Glide', 'candy', 200, 9)
  .prop({ need: 20 })
  .G(0, 20, 12).start(2, 11).stars(5, 18, 10, 2)
  .e('popper', 26, 11, { per: 140, dir: -1 }).G(21, 40, 12).stars(22, 38, 9, 2).mush(32, 33, 11).P(34, 38, 5).big(37, 4)
  .G(41, 44, 12).belt(45, 60, 12, 1).G(45, 60, 12).belt(45, 60, 12, 1).spikes(50, 51, 11).arc(49, 8, 4).e('check', 62, 11).G(61, 80, 12)
  .e('popper', 72, 11, { per: 120, dir: -1, ph: 40 }).e('popper', 78, 11, { per: 120, dir: -1, ph: 100 }).stars(64, 70, 10)
  .MG(83, 84, 11).MG(89, 90, 10).MG(95, 96, 11).arc(85, 7, 5).arc(91, 7, 4).G(99, 140, 12).big(92, 2)
  .crumb(104, 110, 9).stars(104, 110, 8).e('snail', 114, 11).e('heart', 118, 9).e('check', 122, 11).e('popper', 132, 11, { per: 110, dir: -1 })
  .belt(141, 160, 12, -1).G(141, 160, 12).belt(141, 160, 12, -1).e('bee', 150, 9, { r: 2 }).stars(141, 160, 9, 2).G(161, 200, 12).clear(166, 12, 169, 13).big(168, 13)
  .e('frog', 175, 11).stars(180, 186, 10).e('goal', 192, 11)
  .done());
levels.push(L('B-2', 'Taffy Twist', 'candy', 210, 9)
  .prop({ need: 50 })
  .G(0, 15, 12).start(2, 11).e('power', 5, 11).stars(7, 13, 10)
  .belt(16, 22, 10, 1).belt(26, 32, 8, 1).belt(36, 42, 10, -1).G(46, 70, 12).stars(16, 42, 6, 3).big(29, 12).P(26, 32, 13)
  .e('popper', 52, 11, { per: 100, dir: 1 }).e('popper', 66, 11, { per: 100, dir: -1, ph: 50 }).e('check', 48, 11).stars(55, 63, 10, 2)
  .crumb(71, 74, 11).crumb(77, 80, 10).crumb(83, 86, 9).G(89, 120, 9).stars(71, 86, 7, 3).e('bee', 95, 6, { r: 2 }).e('frog', 104, 8).MG(110, 111, 8).P(112, 116, 2).big(115, 1)
  .e('check', 118, 8).wind(121, 0, 20, 15, { fx: 0.6, per: 200, on: 100 }).G(121, 124, 12).G(129, 131, 11).G(136, 138, 10).G(143, 170, 9).stars(122, 140, 7, 3)
  .e('popper', 150, 8, { per: 90, dir: -1 }).e('heart', 154, 6).e('pengu', 160, 8).swA(164, 165, 2, 8).e('switch', 162, 8).big(167, 5).P(166, 169, 6)
  .G(171, 210, 12).e('popper', 182, 11, { per: 120, dir: -1 }).e('snail', 190, 11).stars(192, 198, 10).e('goal', 202, 11)
  .done());
levels.push(L('B-3', 'Sugar Rush Summit', 'candy', 220, 9)
  .prop({ need: 90 })
  .G(0, 12, 12).start(2, 11).stars(4, 10, 10)
  .MG(15, 16, 11).MG(21, 22, 9).MG(27, 28, 7).G(32, 50, 6).e('popper', 44, 5, { per: 110, dir: -1 }).stars(15, 28, 5, 2).big(50, 2).P(48, 50, 3)
  .crumb(51, 56, 6).e('plat', 58, 7, { len: 2, r: 5, sp: 0.009 }).G(66, 90, 9).e('check', 68, 8).belt(72, 86, 9, -1).e('wisp', 80, 5).stars(52, 64, 4, 2)
  .e('geyser', 78, 8, { per: 140, on: 45 }).spikes(88, 89, 8).G(91, 94, 12).lava(95, 104, 13).e('plat', 95, 10, { len: 2, r: 6, sp: 0.008 }).G(105, 130, 12).stars(95, 104, 8, 2)
  .e('popper', 112, 11, { per: 80, dir: -1 }).e('popper', 122, 11, { per: 80, dir: -1, ph: 40 }).e('check', 108, 11).e('heart', 116, 9).IG(126, 130, 12)
  .IG(131, 150, 12).e('pengu', 140, 11).B(134, 2, 148, 7).e('icicle', 137, 8).e('icicle', 143, 8).G(151, 160, 12).wind(153, 2, 4, 13, { fy: 0.95 }).G(157, 175, 4).stars(132, 148, 10, 3)
  .big(170, 1).e('bee', 165, 2, { r: 1 }).G(176, 220, 12).e('frog', 184, 11).swB(190, 194, 9).e('switch', 187, 11).big(192, 8).e('urchin', 198, 11).stars(200, 206, 10).e('goal', 212, 11)
  .done());
}
