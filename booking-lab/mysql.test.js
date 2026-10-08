"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {assertLabConfig} = require("./mysql");

test("lab requires explicit enable flag", () => {
  const prior = process.env.BOOKING_LAB_ENABLED;
  delete process.env.BOOKING_LAB_ENABLED;
  assert.throws(() => assertLabConfig({database:"artyou_booking_lab"}));
  if (prior === undefined) delete process.env.BOOKING_LAB_ENABLED;
  else process.env.BOOKING_LAB_ENABLED = prior;
});

test("lab refuses production and shared database names", () => {
  const old = {enabled:process.env.BOOKING_LAB_ENABLED,node:process.env.NODE_ENV,vercel:process.env.VERCEL_ENV};
  try {
    process.env.BOOKING_LAB_ENABLED = "true";
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;
    assert.throws(() => assertLabConfig({database:"artyou"}));
    assert.doesNotThrow(() => assertLabConfig({database:"artyou_booking_lab"}));
    process.env.VERCEL_ENV = "production";
    assert.throws(() => assertLabConfig({database:"artyou_booking_lab"}));
  } finally {
    for (const [key,value] of Object.entries({BOOKING_LAB_ENABLED:old.enabled,NODE_ENV:old.node,VERCEL_ENV:old.vercel})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
