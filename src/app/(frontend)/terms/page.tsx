import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalLayout } from '@/components/legal-layout'

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Syarat dan Ketentuan penggunaan layanan InTourney.',
  alternates: { canonical: '/terms' },
}

const EFFECTIVE_DATE = '9 September 2026'

export default function TermsPage() {
  return (
    <LegalLayout
      title="Syarat & Ketentuan"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <p>
          Dokumen ini mengatur penggunaan Anda atas InTourney ("Layanan"), termasuk situs publik,
          Quick Bracket Tournament, dan area Event Management di <code>/workspaces</code>. Dengan
          mengakses atau menggunakan Layanan, Anda menyetujui Syarat & Ketentuan ini. Jika Anda
          tidak setuju, mohon untuk tidak menggunakan Layanan.
        </p>
      }
      sections={[
        {
          heading: 'Tentang Penyedia Layanan',
          body: (
            <p>
              InTourney saat ini dikelola dan dioperasikan oleh perseorangan (belum berbentuk badan
              hukum/PT/CV) sebagai penyedia platform ("kami", "Pengelola InTourney"). Pertanyaan
              hukum terkait Layanan ini dapat diajukan melalui{' '}
              <a href="mailto:legal@intourney.id">legal@intourney.id</a>.
            </p>
          ),
        },
        {
          heading: 'Penerimaan Syarat',
          body: (
            <p>
              Anda harus berusia minimal 18 tahun, atau menggunakan Layanan dengan izin dan
              pengawasan orang tua/wali, untuk membuat akun Event Management. Quick Bracket
              Tournament dapat digunakan tanpa membuat akun sebagaimana dijelaskan pada bagian 4.
            </p>
          ),
        },
        {
          heading: 'Akun Pengguna',
          body: (
            <>
              <p>
                Saat mendaftar melalui email/kata sandi atau Google Sign-In, Anda bertanggung jawab
                menjaga kerahasiaan kredensial akun dan atas seluruh aktivitas yang terjadi di bawah
                akun Anda. Segera beri tahu kami melalui{' '}
                <a href="mailto:legal@intourney.id">legal@intourney.id</a> jika Anda mencurigai
                adanya penggunaan akun tanpa izin.
              </p>
              <p>
                Akun baru secara otomatis mendapatkan peran "Event Admin" yang memungkinkan Anda
                membuat dan mengelola event Anda sendiri. Kami dapat menangguhkan atau menghapus
                akun yang melanggar Syarat ini.
              </p>
            </>
          ),
        },
        {
          heading: 'Quick Bracket Tournament (Tanpa Login)',
          body: (
            <p>
              Fitur Quick Bracket memungkinkan pembuatan bagan turnamen tanpa akun. Bagan yang
              dibuat melalui fitur ini bersifat sementara dan akan kedaluwarsa/dihapus secara
              otomatis setelah jangka waktu tertentu, kecuali Anda mengklaimnya menjadi event penuh
              dengan membuat akun. Kami mencatat alamat IP pembuat bagan untuk keperluan pencegahan
              penyalahgunaan (lihat <Link href="/privacy">Kebijakan Privasi</Link>).
            </p>
          ),
        },
        {
          heading: 'Konten & Data yang Anda Masukkan',
          body: (
            <>
              <p>
                Sebagai penyelenggara event, Anda dapat memasukkan data pihak lain ke dalam Layanan
                - misalnya nama klub, tim, dan peserta/atlet (termasuk nama, email, nomor telepon,
                foto, atau data kontak lain) - baik secara manual maupun melalui impor Excel. Anda
                menyatakan dan menjamin bahwa Anda memiliki hak dan izin yang sah untuk memasukkan
                dan mengelola data tersebut di dalam Layanan, termasuk persetujuan dari pihak yang
                datanya Anda masukkan bila diwajibkan oleh hukum yang berlaku.
              </p>
              <p>
                Anda bertanggung jawab penuh atas keakuratan dan legalitas konten yang Anda unggah,
                dan setuju untuk tidak mengunggah konten yang melanggar hukum, mengandung ujaran
                kebencian, atau melanggar hak pihak ketiga.
              </p>
            </>
          ),
        },
        {
          heading: 'Berlangganan, Pembayaran & Pengembalian Dana',
          body: (
            <>
              <p>
                Akses ke area Event Management (<code>/workspaces</code>) memerlukan langganan
                aktif. Paket dan harga langganan ditampilkan secara langsung (live) di halaman{' '}
                <Link href="/pricing">Pricing</Link> sesuai produk yang kami sediakan.
              </p>
              <p>
                <strong>Pemrosesan pembayaran dilakukan oleh pihak ketiga, Berlanggan
                (berlanggan.web.id)</strong> ("Berlanggan"), yang bertindak sebagai penyedia
                infrastruktur penagihan dan aktivasi lisensi independen dari InTourney. Saat Anda
                memilih paket, Anda akan diarahkan ke halaman checkout milik Berlanggan untuk
                menyelesaikan pembayaran; syarat pembayaran, metode pembayaran, dan kebijakan
                mereka sendiri turut berlaku pada transaksi tersebut. Setelah pembayaran berhasil,
                Anda akan menerima kunci lisensi ("license key") yang perlu Anda aktivasi pada
                halaman <Link href="/subscribe">Subscribe</Link> untuk mengaitkannya dengan akun
                InTourney Anda.
              </p>
              <p>
                Satu kunci lisensi hanya dapat diaktivasi pada satu akun InTourney pada satu waktu.
                Status langganan Anda (aktif, masa tenggang, kedaluwarsa, dicabut, atau
                ditangguhkan) divalidasi ulang secara berkala terhadap sistem Berlanggan.
              </p>
              <p>
                Permintaan pengembalian dana (refund) mengikuti kebijakan yang berlaku di
                Berlanggan sebagai penyedia pembayaran. Untuk kendala aktivasi, tautan lisensi yang
                salah, atau sengketa penagihan yang berkaitan dengan penggunaan Layanan InTourney,
                hubungi kami melalui <a href="mailto:legal@intourney.id">legal@intourney.id</a> dan
                kami akan membantu menghubungkan Anda dengan proses yang tepat.
              </p>
            </>
          ),
        },
        {
          heading: 'Larangan Penggunaan',
          body: (
            <ul>
              <li>Menyalahgunakan, meretas, atau mengganggu operasional Layanan.</li>
              <li>Mengumpulkan data pengguna lain tanpa izin (scraping, harvesting).</li>
              <li>Mengunggah konten ilegal, menyesatkan, atau melanggar hak kekayaan intelektual pihak lain.</li>
              <li>Menggunakan Layanan untuk tujuan penipuan terhadap peserta turnamen.</li>
              <li>Mencoba mendapatkan akses tidak sah ke akun, event, atau data milik pihak lain.</li>
            </ul>
          ),
        },
        {
          heading: 'Kekayaan Intelektual',
          body: (
            <p>
              Nama "InTourney", logo, dan tampilan antarmuka Layanan adalah milik Pengelola
              InTourney. Konten yang Anda unggah tetap menjadi milik Anda atau pemilik aslinya;
              dengan mengunggahnya, Anda memberi kami lisensi terbatas untuk menyimpan dan
              menampilkannya sepanjang diperlukan untuk menjalankan Layanan (misalnya menampilkan
              bagan dan jadwal di halaman publik event Anda).
            </p>
          ),
        },
        {
          heading: 'Batasan Tanggung Jawab',
          body: (
            <p>
              Layanan disediakan "sebagaimana adanya" (as is) tanpa jaminan apa pun, tersurat
              maupun tersirat. Sepanjang diizinkan oleh hukum yang berlaku, Pengelola InTourney
              tidak bertanggung jawab atas kerugian tidak langsung, insidental, atau konsekuensial
              yang timbul dari penggunaan atau ketidakmampuan menggunakan Layanan, termasuk namun
              tidak terbatas pada kerugian akibat gangguan penyelenggaraan turnamen, kehilangan
              data, atau kegagalan transaksi pihak ketiga (termasuk Berlanggan).
            </p>
          ),
        },
        {
          heading: 'Penghentian Layanan',
          body: (
            <p>
              Kami dapat menangguhkan atau menghentikan akses Anda ke Layanan jika Anda melanggar
              Syarat ini, atau menghentikan sebagian/seluruh Layanan sewaktu-waktu dengan
              pemberitahuan yang wajar bila memungkinkan. Anda dapat berhenti menggunakan Layanan
              dan meminta penghapusan akun kapan saja melalui{' '}
              <a href="mailto:legal@intourney.id">legal@intourney.id</a>.
            </p>
          ),
        },
        {
          heading: 'Perubahan Syarat',
          body: (
            <p>
              Kami dapat memperbarui Syarat & Ketentuan ini dari waktu ke waktu. Perubahan berlaku
              sejak tanggal "Berlaku efektif" di atas diperbarui. Penggunaan Layanan yang
              berkelanjutan setelah perubahan berarti Anda menyetujui Syarat yang telah diperbarui.
            </p>
          ),
        },
        {
          heading: 'Hukum yang Berlaku',
          body: (
            <p>
              Syarat & Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Republik Indonesia,
              termasuk namun tidak terbatas pada Undang-Undang Nomor 11 Tahun 2008 tentang
              Informasi dan Transaksi Elektronik sebagaimana diubah dengan Undang-Undang Nomor 19
              Tahun 2016, Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen, dan
              Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
            </p>
          ),
        },
        {
          heading: 'Kontak',
          body: (
            <p>
              Pertanyaan mengenai Syarat & Ketentuan ini dapat disampaikan ke{' '}
              <a href="mailto:legal@intourney.id">legal@intourney.id</a>. Lihat juga{' '}
              <Link href="/contact">Hubungi Kami</Link> untuk kanal lainnya.
            </p>
          ),
        },
      ]}
    />
  )
}
