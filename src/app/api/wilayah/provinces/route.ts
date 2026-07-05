import { NextResponse } from "next/server";

const PROVINCES = [
  "Aceh", "Bali", "Banten", "Bengkulu", "DI Yogyakarta",
  "DKI Jakarta", "Gorontalo", "Jambi", "Jawa Barat", "Jawa Tengah",
  "Jawa Timur", "Kalimantan Barat", "Kalimantan Selatan", "Kalimantan Tengah",
  "Kalimantan Timur", "Kalimantan Utara", "Kepulauan Bangka Belitung",
  "Kepulauan Riau", "Lampung", "Maluku", "Maluku Utara",
  "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Papua", "Papua Barat",
  "Papua Barat Daya", "Papua Pegunungan", "Papua Selatan", "Papua Tengah",
  "Riau", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tengah",
  "Sulawesi Tenggara", "Sulawesi Utara", "Sumatera Barat", "Sumatera Selatan",
  "Sumatera Utara",
];

export async function GET() {
  return NextResponse.json(PROVINCES);
}