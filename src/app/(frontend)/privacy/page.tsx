import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalLayout } from '@/components/legal-layout'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Kebijakan Privasi InTourney: data apa yang kami kumpulkan dan bagaimana kami menggunakannya.',
  alternates: { canonical: '/privacy' },
}

const EFFECTIVE_DATE = '9 September 2026'

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Kebijakan Privasi"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <p>
          Kebijakan Privasi ini menjelaskan bagaimana InTourney ("kami") mengumpulkan, menggunakan,
          dan melindungi data pribadi saat Anda menggunakan Layanan, sesuai dengan Undang-Undang
          Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi ("UU PDP"). Dengan menggunakan
          Layanan, Anda menyetujui praktik yang dijelaskan di sini - lihat juga{' '}
          <Link href="/terms">Syarat & Ketentuan</Link>.
        </p>
      }
      sections={[
        {
          heading: 'Data yang Kami Kumpulkan',
          body: (
            <>
              <p>Kami mengumpulkan data berikut, tergantung bagaimana Anda menggunakan Layanan:</p>
              <ul>
                <li>
                  <strong>Akun</strong> - nama, alamat email, dan kata sandi (tersimpan terenkripsi)
                  saat Anda mendaftar; atau nama, email, dan foto profil dari akun Google Anda jika
                  Anda mendaftar melalui "Sign in with Google".
                </li>
                <li>
                  <strong>Data event & peserta</strong> - saat Anda (sebagai penyelenggara)
                  membuat event, klub, tim, atau peserta, kami menyimpan data yang Anda masukkan,
                  misalnya nama peserta, nomor identitas, email, nomor telepon, foto, jenis
                  kelamin, dan nama/email kontak klub atau tim.
                </li>
                <li>
                  <strong>Formulir pendaftaran publik</strong> - saat seseorang mendaftar ke event
                  melalui formulir publik, kami menyimpan nama pendaftar, kontak (email/telepon),
                  data anggota rombongan, dan alamat IP pengirim untuk mencegah penyalahgunaan.
                </li>
                <li>
                  <strong>Quick Bracket (tanpa akun)</strong> - nama peserta yang Anda masukkan ke
                  dalam bagan dan alamat IP pembuat bagan.
                </li>
                <li>
                  <strong>Data langganan</strong> - saat Anda mengaktivasi lisensi Event Management,
                  kami menyimpan status langganan dan pengenal aktivasi yang dipertukarkan dengan
                  Berlanggan (berlanggan.web.id) sebagai mitra pemrosesan pembayaran kami; kami
                  tidak menyimpan detail kartu/metode pembayaran Anda - itu ditangani sepenuhnya
                  oleh Berlanggan.
                </li>
                <li>
                  <strong>Data teknis</strong> - alamat IP, jenis perangkat/browser, dan halaman
                  yang dikunjungi, dikumpulkan secara otomatis untuk keperluan keamanan dan
                  analitik (lihat bagian Cookie & Analitik).
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Bagaimana Kami Menggunakan Data',
          body: (
            <ul>
              <li>Menyediakan dan mengoperasikan fitur Layanan (event, bagan, jadwal, hasil pertandingan, papan klasemen publik).</li>
              <li>Mengautentikasi akun dan menjaga keamanan Layanan.</li>
              <li>Memproses dan memvalidasi status langganan Event Management.</li>
              <li>Berkomunikasi dengan Anda terkait akun, dukungan, atau perubahan kebijakan.</li>
              <li>Mencegah penyalahgunaan, penipuan, dan pelanggaran Syarat & Ketentuan.</li>
              <li>Menganalisis penggunaan situs secara agregat untuk meningkatkan Layanan.</li>
            </ul>
          ),
        },
        {
          heading: 'Berbagi Data dengan Pihak Ketiga',
          body: (
            <>
              <p>Kami tidak menjual data pribadi Anda. Kami membagikan data secukupnya kepada:</p>
              <ul>
                <li>
                  <strong>Berlanggan (berlanggan.web.id)</strong> - untuk pemrosesan pembayaran dan
                  aktivasi lisensi Event Management, kami mengirimkan pengenal akun (bukan kata
                  sandi Anda) untuk memvalidasi status langganan.
                </li>
                <li>
                  <strong>Google</strong> - jika Anda memilih "Sign in with Google", Google
                  memproses autentikasi Anda sesuai kebijakan privasi mereka sendiri.
                </li>
                <li>
                  <strong>Penyedia hosting & infrastruktur</strong> - server dan basis data yang
                  menjalankan Layanan.
                </li>
                <li>
                  <strong>Data yang Anda pilih tampilkan secara publik</strong> - nama peserta,
                  bagan, jadwal, dan hasil pertandingan yang Anda publikasikan di halaman event
                  publik dapat dilihat oleh siapa saja yang mengakses tautan tersebut - ini adalah
                  fungsi inti Layanan (papan turnamen publik), bukan berbagi data ke pihak ketiga
                  lain di luar itu.
                </li>
              </ul>
              <p>
                Kami dapat mengungkapkan data jika diwajibkan oleh hukum yang berlaku atau untuk
                melindungi hak, keamanan, dan properti InTourney maupun penggunanya.
              </p>
            </>
          ),
        },
        {
          heading: 'Penyimpanan & Keamanan Data',
          body: (
            <p>
              Data disimpan pada basis data yang kami kelola dan dilindungi dengan praktik keamanan
              yang wajar (kata sandi terenkripsi, kontrol akses berbasis peran). Namun, tidak ada
              sistem yang sepenuhnya bebas risiko; kami tidak dapat menjamin keamanan mutlak atas
              data yang dikirimkan melalui internet. Data disimpan selama akun atau event terkait
              masih aktif, atau selama diperlukan untuk memenuhi kewajiban hukum.
            </p>
          ),
        },
        {
          heading: 'Hak Anda',
          body: (
            <>
              <p>Sesuai UU PDP, Anda berhak untuk:</p>
              <ul>
                <li>Meminta akses dan salinan data pribadi Anda yang kami simpan.</li>
                <li>Meminta koreksi atas data yang tidak akurat.</li>
                <li>Meminta penghapusan akun dan data pribadi Anda, dengan pengecualian data yang wajib kami simpan untuk kepatuhan hukum.</li>
                <li>Menarik persetujuan Anda atas pemrosesan data tertentu, sepanjang tidak diwajibkan oleh hukum untuk tetap disimpan.</li>
              </ul>
              <p>
                Untuk menggunakan hak-hak ini, hubungi kami di{' '}
                <a href="mailto:privacy@intourney.id">privacy@intourney.id</a>. Jika Anda adalah
                peserta yang datanya dimasukkan oleh penyelenggara event (bukan pemilik akun),
                silakan hubungi penyelenggara event terkait terlebih dahulu, atau hubungi kami dan
                kami akan membantu menindaklanjuti.
              </p>
            </>
          ),
        },
        {
          heading: 'Data Anak',
          body: (
            <p>
              Layanan ini tidak ditujukan untuk anak-anak di bawah 13 tahun sebagai pemegang akun.
              Kami memahami bahwa data peserta turnamen yang dimasukkan oleh penyelenggara dapat
              mencakup data anak (misalnya peserta kompetisi olahraga usia sekolah) - dalam hal
              ini, penyelenggara event bertanggung jawab memastikan adanya persetujuan orang tua/wali
              yang sah sebelum memasukkan data tersebut ke Layanan, sebagaimana diatur pada bagian
              "Konten & Data yang Anda Masukkan" di <Link href="/terms">Syarat & Ketentuan</Link>.
            </p>
          ),
        },
        {
          heading: 'Cookie & Analitik',
          body: (
            <p>
              Kami menggunakan cookie sesi yang diperlukan untuk menjaga status login Anda. Jika
              diaktifkan, kami juga menggunakan Google Analytics untuk memahami penggunaan situs
              secara agregat (misalnya halaman yang paling banyak dikunjungi) - data ini tidak kami
              gunakan untuk mengidentifikasi Anda secara individual. Anda dapat mengatur browser
              Anda untuk menolak cookie, meski beberapa fitur Layanan mungkin tidak berfungsi
              dengan baik tanpanya.
            </p>
          ),
        },
        {
          heading: 'Perubahan Kebijakan',
          body: (
            <p>
              Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan berlaku
              sejak tanggal "Berlaku efektif" di atas diperbarui. Kami mendorong Anda meninjau
              halaman ini secara berkala.
            </p>
          ),
        },
        {
          heading: 'Kontak',
          body: (
            <p>
              Pertanyaan atau permintaan terkait privasi dapat disampaikan ke{' '}
              <a href="mailto:privacy@intourney.id">privacy@intourney.id</a>. Lihat juga{' '}
              <Link href="/contact">Hubungi Kami</Link> untuk kanal lainnya.
            </p>
          ),
        },
      ]}
    />
  )
}
