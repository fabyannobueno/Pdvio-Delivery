import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://luznrsvdmlwcajoxaekn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1em5yc3ZkbWx3Y2Fqb3hhZWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzkxOTIsImV4cCI6MjA5MjU1NTE5Mn0.YOFaS2i1uiH4rzY7kYNJNG-0XAwY2quZnjVg4ZB9FLQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
