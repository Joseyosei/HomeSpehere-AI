import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demo,insights} from '../public/model.mjs';
test('demo flags all three conditions',()=>assert.equal(insights(demo).length,3));
test('missing metrics are not interpreted as zero or high',()=>assert.deepEqual(insights({powerW:null,humidity:null,devices:[]}),['No configured thresholds exceeded.']));
test('normal readings',()=>assert.equal(insights({powerW:500,humidity:45,devices:[]}).length,1));
