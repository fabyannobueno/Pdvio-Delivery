-- Migration: add change_for and change_amount to delivery_orders
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE delivery_orders
  ADD COLUMN IF NOT EXISTS change_for NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS change_amount NUMERIC DEFAULT NULL;
