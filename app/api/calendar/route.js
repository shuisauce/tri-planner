import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function ds(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return new Response("Supabase not configured", { status: 500 });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("planner")
    .select("schedule")
    .eq("id", "main")
    .single();

  if (error || !data?.schedule) {
    return new Response("No schedule data found", { status: 404 });
  }

  const schedule = data.schedule;
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KMS Anesthesia//Schedule Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:KMS Work Schedule",
    `X-WR-TIMEZONE:America/Detroit`,
  ];

  for (const [k, day] of Object.entries(schedule)) {
    if (!day.shift) continue;

    const dt = k.replace(/-/g, "");
    const h = day.shift.hours;
    const endHour = 7 + h;
    const endDay = endHour >= 24 ? addDays(new Date(k + "T12:00:00"), 1) : null;
    const endDt = endDay ? ds(endDay).replace(/-/g, "") : dt;
    const eH = endHour >= 24 ? endHour - 24 : endHour;
    const hospFull =
      day.shift.hospital === "HFH"
        ? "Henry Ford Health Providence"
        : day.shift.hospital === "GR"
        ? "Grand Rapids"
        : "";

    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTART;TZID=America/Detroit:${dt}T070000`);
    lines.push(`DTEND;TZID=America/Detroit:${endDt}T${String(eH).padStart(2, "0")}0000`);
    lines.push(`SUMMARY:${h}h Shift${day.shift.hospital ? " - " + day.shift.hospital : ""}`);
    if (hospFull) lines.push(`LOCATION:${hospFull}`);
    lines.push(`UID:${k}-shift@kms-planner`);
    lines.push(`DTSTAMP:${now}`);
    lines.push("END:VEVENT");

    // Also add vacation days as all-day events
    if (day.vacation) {
      lines.push("BEGIN:VEVENT");
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      lines.push(`DTEND;VALUE=DATE:${dt}`);
      lines.push(`SUMMARY:🏖️ Vacation`);
      lines.push(`UID:${k}-vacation@kms-planner`);
      lines.push(`DTSTAMP:${now}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="kms-schedule.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
