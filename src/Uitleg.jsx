import { btn1, btn2 } from './styles.js';

/**
 * Detailed explanation page ("Hoe werkt BouwFactuur?"), reachable at
 * #/uitleg for both visitors and logged-in users.
 */
export default function Uitleg({ onBack, onRegister, loggedIn }) {
  const h2 = { fontSize: '14px', fontWeight: 700, margin: '28px 0 8px', letterSpacing: '-.01em' };
  const p = { fontSize: '12px', color: 'var(--tx)', lineHeight: 1.75, margin: '0 0 10px' };
  const note = { fontSize: '11px', color: 'var(--tm)', lineHeight: 1.7 };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ borderBottom: '1px solid var(--bd)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-.01em' }}>
          Bouw<span style={{ color: 'var(--ac)' }}>Factuur</span>
        </span>
        <button onClick={onBack} style={{ ...btn2, padding: '7px 14px', fontSize: '11px' }}>
          {loggedIn ? '← Terug naar de app' : '← Terug'}
        </button>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 10px' }}>
          Hoe werkt BouwFactuur?
        </h1>
        <p style={p}>
          BouwFactuur helpt onderaannemers en zzp'ers in de bouw om in enkele
          minuten een factuur te maken die voldoet aan de Nederlandse regels.
          U doorloopt een korte wizard van drie stappen, controleert het
          resultaat en exporteert de factuur als PDF of als UBL e-factuur.
        </p>

        <h2 style={h2}>Stap 1 — Uw gegevens en de opdrachtgever</h2>
        <p style={p}>
          U vult eenmalig uw bedrijfsgegevens in (naam, adres, KvK-nummer,
          BTW-nummer, IBAN en eventueel uw G-rekening). Deze worden bij uw
          account bewaard, zodat elke volgende factuur direct klaarstaat.
          Voor de opdrachtgever kunt u gegevens automatisch ophalen via een
          KvK-zoekfunctie, en een BTW-nummer direct valideren bij VIES, het
          Europese controlesysteem. Vaste opdrachtgevers slaat u op voor
          hergebruik.
        </p>

        <h2 style={h2}>Stap 2 — Factuurregels</h2>
        <p style={p}>
          U voert de werkzaamheden in en markeert elke regel als arbeid of
          materiaal. Dat onderscheid is belangrijk: de G-rekening splitsing
          wordt berekend over het arbeidsdeel. Voor arbeid kunt u uren en
          uurtarief invullen, waarna het bedrag automatisch wordt berekend.
          De betaaltermijn bepaalt de vervaldatum, die direct zichtbaar is.
        </p>

        <h2 style={h2}>Stap 3 — Controle en export</h2>
        <p style={p}>
          Vóór export toetst BouwFactuur uw factuur aan de factuurvereisten
          van de Belastingdienst: zijn alle verplichte gegevens aanwezig, is
          het IBAN geldig (controlegetal), staat het BTW-nummer van de
          opdrachtgever erop als de BTW is verlegd? Ontbreekt er iets, dan
          ziet u precies wat. Daarna exporteert u de factuur als PDF of als
          NLCIUS UBL 2.1 e-factuur (het formaat voor Peppol en voor de
          Rijksoverheid).
        </p>

        <h2 style={h2}>BTW verlegd: hoe zit dat?</h2>
        <p style={p}>
          In de bouw geldt bij onderaanneming meestal de verleggingsregeling:
          u brengt geen BTW in rekening, maar verlegt deze naar uw
          opdrachtgever (art. 12 lid 5 Wet OB 1968). Op de factuur moet dan
          "BTW verlegd" staan, mét het BTW-nummer van de opdrachtgever.
          BouwFactuur regelt beide automatisch. Factureert u wél met BTW,
          dan kiest u het tarief: 21%, 9% (bijvoorbeeld renovatie van
          woningen ouder dan twee jaar, arbeidsdeel) of 0%.
        </p>

        <h2 style={h2}>G-rekening en de Wet ketenaansprakelijkheid</h2>
        <p style={p}>
          Werkt u in onderaanneming, dan kan uw opdrachtgever aansprakelijk
          worden gesteld voor uw loonheffingen (Wka). Daarom betalen veel
          aannemers een deel van de factuur op uw geblokkeerde G-rekening.
          BouwFactuur splitst het factuurbedrag automatisch: een percentage
          van het arbeidsdeel (instelbaar, met een gangbaar percentage per
          vakgebied als vertrekpunt) naar de G-rekening, de rest naar uw
          gewone rekening. Beide bedragen en rekeningnummers staan duidelijk
          op de factuur, met het kenmerk van de overeenkomst voor de
          Wka-administratie.
        </p>

        <h2 style={h2}>Uw gegevens</h2>
        <p style={p}>
          BouwFactuur werkt met een gratis account (e-mailadres en wachtwoord,
          of inloggen met Google). Uw bedrijfsprofiel, opdrachtgevers en
          factuurhistorie worden veilig in de cloud bewaard en zijn alleen
          voor u toegankelijk, op al uw apparaten. In de factuurhistorie ziet
          u welke facturen openstaan en wat het uitstaande bedrag is, en kunt
          u op elk moment een volledige backup van uw gegevens downloaden of
          terugzetten.
        </p>

        <p style={{ ...note, marginTop: '18px' }}>
          BouwFactuur is een hulpmiddel en geen fiscaal of juridisch advies.
          Twijfelt u over de verleggingsregeling of uw Wka-verplichtingen,
          raadpleeg dan uw boekhouder of adviseur.
        </p>

        {!loggedIn && (
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
            <button onClick={onRegister} style={{ ...btn1, padding: '11px 26px', fontSize: '12px' }}>
              Gratis account aanmaken
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
