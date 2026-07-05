import { NextRequest, NextResponse } from "next/server";

const CITIES_BY_PROVINCE: Record<string, string[]> = {
  "Aceh": ["Banda Aceh","Langsa","Lhokseumawe","Sabang","Subulussalam","Aceh Besar","Aceh Barat","Aceh Tengah","Aceh Timur","Aceh Utara","Bireuen","Pidie","Simeulue"],
  "Bali": ["Denpasar","Badung","Bangli","Buleleng","Gianyar","Jembrana","Karangasem","Klungkung","Tabanan"],
  "Banten": ["Serang","Cilegon","Tangerang","Tangerang Selatan","Lebak","Pandeglang"],
  "Bengkulu": ["Bengkulu","Bengkulu Selatan","Bengkulu Tengah","Bengkulu Utara","Kaur","Kepahiang","Lebong","Mukomuko","Rejang Lebong","Seluma"],
  "DI Yogyakarta": ["Yogyakarta","Bantul","Gunungkidul","Kulon Progo","Sleman"],
  "DKI Jakarta": ["Jakarta Pusat","Jakarta Utara","Jakarta Barat","Jakarta Selatan","Jakarta Timur","Kepulauan Seribu"],
  "Gorontalo": ["Gorontalo","Boalemo","Bone Bolango","Gorontalo Utara","Pohuwato"],
  "Jambi": ["Jambi","Sungai Penuh","Batanghari","Bungo","Kerinci","Merangin","Muaro Jambi","Sarolangun","Tanjung Jabung Barat","Tanjung Jabung Timur","Tebo"],
  "Jawa Barat": ["Bandung","Banjar","Bekasi","Bogor","Cimahi","Cirebon","Depok","Sukabumi","Tasikmalaya","Bandung Barat","Ciamis","Cianjur","Garut","Indramayu","Karawang","Kuningan","Majalengka","Pangandaran","Purwakarta","Subang","Sumedang"],
  "Jawa Tengah": ["Semarang","Magelang","Pekalongan","Salatiga","Surakarta","Tegal","Banjarnegara","Banyumas","Batang","Blora","Boyolali","Brebes","Cilacap","Demak","Grobogan","Jepara","Karanganyar","Kebumen","Kendal","Klaten","Kudus","Pati","Pemalang","Purbalingga","Purworejo","Rembang","Sragen","Sukoharjo","Temanggung","Wonogiri","Wonosobo"],
  "Jawa Timur": ["Surabaya","Batu","Blitar","Kediri","Madiun","Malang","Mojokerto","Pasuruan","Probolinggo","Bangkalan","Banyuwangi","Bojonegoro","Bondowoso","Gresik","Jember","Jombang","Lamongan","Lumajang","Magetan","Nganjuk","Ngawi","Pacitan","Pamekasan","Ponorogo","Sampang","Sidoarjo","Situbondo","Sumenep","Trenggalek","Tuban","Tulungagung"],
  "Kalimantan Barat": ["Pontianak","Singkawang","Bengkayang","Kapuas Hulu","Kayong Utara","Ketapang","Kubu Raya","Landak","Melawi","Mempawah","Sambas","Sanggau","Sekadau","Sintang"],
  "Kalimantan Selatan": ["Banjarmasin","Banjarbaru","Balangan","Banjar","Barito Kuala","Hulu Sungai Selatan","Hulu Sungai Tengah","Hulu Sungai Utara","Kotabaru","Tabalong","Tanah Bumbu","Tanah Laut","Tapin"],
  "Kalimantan Tengah": ["Palangka Raya","Barito Selatan","Barito Timur","Barito Utara","Gunung Mas","Kapuas","Katingan","Kotawaringin Barat","Kotawaringin Timur","Lamandau","Murung Raya","Pulang Pisau","Seruyan","Sukamara"],
  "Kalimantan Timur": ["Samarinda","Balikpapan","Bontang","Berau","Kutai Barat","Kutai Kartanegara","Kutai Timur","Mahakam Ulu","Paser","Penajam Paser Utara"],
  "Kalimantan Utara": ["Tanjung Selor","Tarakan","Bulungan","Malinau","Nunukan","Tana Tidung"],
  "Kepulauan Bangka Belitung": ["Pangkal Pinang","Bangka","Bangka Barat","Bangka Selatan","Bangka Tengah","Belitung","Belitung Timur"],
  "Kepulauan Riau": ["Batam","Tanjung Pinang","Bintan","Karimun","Kepulauan Anambas","Lingga","Natuna"],
  "Lampung": ["Bandar Lampung","Metro","Lampung Barat","Lampung Selatan","Lampung Tengah","Lampung Timur","Lampung Utara","Mesuji","Pesawaran","Pesisir Barat","Pringsewu","Tanggamus","Tulang Bawang","Tulang Bawang Barat","Way Kanan"],
  "Maluku": ["Ambon","Tual","Buru","Buru Selatan","Kepulauan Aru","Kepulauan Tanimbar","Maluku Barat Daya","Maluku Tengah","Maluku Tenggara","Seram Bagian Barat","Seram Bagian Timur"],
  "Maluku Utara": ["Ternate","Tidore Kepulauan","Halmahera Barat","Halmahera Selatan","Halmahera Tengah","Halmahera Timur","Halmahera Utara","Kepulauan Sula","Pulau Morotai","Pulau Taliabu"],
  "Nusa Tenggara Barat": ["Mataram","Bima","Dompu","Lombok Barat","Lombok Tengah","Lombok Timur","Lombok Utara","Sumbawa","Sumbawa Barat"],
  "Nusa Tenggara Timur": ["Kupang","Alor","Belu","Ende","Flores Timur","Kupang","Lembata","Malaka","Manggarai","Manggarai Barat","Manggarai Timur","Nagekeo","Ngada","Rote Ndao","Sabu Raijua","Sikka","Sumba Barat","Sumba Barat Daya","Sumba Tengah","Sumba Timur","Timor Tengah Selatan","Timor Tengah Utara"],
  "Papua": ["Jayapura","Biak Numfor","Jayapura","Keerom","Kepulauan Yapen","Mamberamo Raya","Sarmi","Supiori","Waropen"],
  "Papua Barat": ["Manokwari","Fakfak","Kaimana","Manokwari Selatan","Pegunungan Arfak","Teluk Bintuni","Teluk Wondama"],
  "Papua Barat Daya": ["Sorong","Maybrat","Raja Ampat","Sorong","Sorong Selatan","Tambrauw"],
  "Papua Pegunungan": ["Jayawijaya","Jayawijaya","Lanny Jaya","Mamberamo Tengah","Nduga","Pegunungan Bintang","Tolikara","Yahukimo","Yalimo"],
  "Papua Selatan": ["Merauke","Asmat","Boven Digoel","Mappi"],
  "Papua Tengah": ["Nabire","Deiyai","Dogiyai","Intan Jaya","Mimika","Paniai","Puncak","Puncak Jaya"],
  "Riau": ["Pekanbaru","Dumai","Bengkalis","Indragiri Hilir","Indragiri Hulu","Kampar","Kepulauan Meranti","Kuantan Singingi","Pelalawan","Rokan Hilir","Rokan Hulu","Siak"],
  "Sulawesi Barat": ["Mamuju","Majene","Mamasa","Mamuju Tengah","Pasangkayu","Polewali Mandar"],
  "Sulawesi Selatan": ["Makassar","Palopo","Parepare","Bantaeng","Barru","Bone","Bulukumba","Enrekang","Gowa","Jeneponto","Kepulauan Selayar","Luwu","Luwu Timur","Luwu Utara","Maros","Pangkajene dan Kepulauan","Pinrang","Sidenreng Rappang","Sinjai","Soppeng","Takalar","Tana Toraja","Toraja Utara","Wajo"],
  "Sulawesi Tengah": ["Palu","Banggai","Banggai Kepulauan","Banggai Laut","Buol","Donggala","Morowali","Morowali Utara","Parigi Moutong","Poso","Sigi","Tojo Una-Una","Tolitoli"],
  "Sulawesi Tenggara": ["Kendari","Bau-Bau","Bombana","Buton","Buton Selatan","Buton Tengah","Buton Utara","Kolaka","Kolaka Timur","Kolaka Utara","Konawe","Konawe Kepulauan","Konawe Selatan","Konawe Utara","Muna","Muna Barat","Wakatobi"],
  "Sulawesi Utara": ["Manado","Bitung","Kotamobagu","Tomohon","Bolaang Mongondow","Bolaang Mongondow Selatan","Bolaang Mongondow Timur","Bolaang Mongondow Utara","Kepulauan Sangihe","Kepulauan Siau Tagulandang Biaro","Kepulauan Talaud","Minahasa","Minahasa Selatan","Minahasa Tenggara","Minahasa Utara"],
  "Sumatera Barat": ["Padang","Bukittinggi","Padang Panjang","Pariaman","Payakumbuh","Sawahlunto","Solok","Agam","Dharmasraya","Kepulauan Mentawai","Lima Puluh Kota","Pasaman","Pasaman Barat","Pesisir Selatan","Sijunjung","Solok Selatan","Tanah Datar"],
  "Sumatera Selatan": ["Palembang","Lubuklinggau","Pagar Alam","Prabumulih","Banyuasin","Empat Lawang","Lahat","Muara Enim","Musi Banyuasin","Musi Rawas","Musi Rawas Utara","Ogan Ilir","Ogan Komering Ilir","Ogan Komering Ulu","Ogan Komering Ulu Selatan","Ogan Komering Ulu Timur","Penukal Abab Lematang Ilir"],
  "Sumatera Utara": ["Medan","Binjai","Gunungsitoli","Padang Sidempuan","Pematangsiantar","Sibolga","Tanjungbalai","Tebing Tinggi","Asahan","Batu Bara","Dairi","Deli Serdang","Humbang Hasundutan","Karo","Labuhanbatu","Labuhanbatu Selatan","Labuhanbatu Utara","Langkat","Mandailing Natal","Nias","Nias Barat","Nias Selatan","Nias Utara","Padang Lawas","Padang Lawas Utara","Pakpak Bharat","Samosir","Serdang Bedagai","Simalungun","Tapanuli Selatan","Tapanuli Tengah","Tapanuli Utara","Toba"],
};

export async function GET(req: NextRequest) {
  const province = req.nextUrl.searchParams.get("province");
  if (!province) return NextResponse.json([]);
  return NextResponse.json(CITIES_BY_PROVINCE[province] || []);
}