# Kraków bez barier

Our HackYeah 2026 project for the **Kraków bez barier** challenge (Miasto Kraków): checking the
accessibility of places and routes against individual needs, built on open data.

- Challenge requirements: [docs/challenge.md](docs/challenge.md)
- Tasks: Linear, team **Krakow Bez Barier** (`KBB-*`)
- Context for humans and AI agents: [AGENTS.md](AGENTS.md)
- Architecture and decisions: [docs/architecture.md](docs/architecture.md)
- Submission materials (Polish): [docs/submission/](docs/submission/), live demo script and jury Q&A:
  [docs/demo-script.md](docs/demo-script.md), [docs/submission/jury-qa.md](docs/submission/jury-qa.md)

## Licence

The **code** in this repository is licensed under the [MIT License](LICENSE)
(© 2026 Zespół Bez Progów).

The MIT License covers our code only, **not the data**. Every data source keeps its own licence and
terms, and the app shows them next to the data (`/o-danych`, the source of each fact):

- OpenStreetMap: ODbL 1.0, attribution "© OpenStreetMap contributors"; the facts we derive from it
  are a derivative database under ODbL;
- BIP Miasta Krakowa: GMK rules for reuse of public-sector information (source, dates, "processed",
  liability disclaimer);
- BIP Małopolska: the open data act, checked per publisher;
- krakow.pl "Kraków bez barier": non-commercial use, commercial use to be confirmed with the city;
- Rejestr Aptek (Centrum e-Zdrowia, dane.gov.pl): CC BY 4.0, with attribution;
- openrouteservice, OpenFreeMap, the layers still waiting for a licence (ZDMK, ZTP) and the
  withheld MSIP toilets layer (not open data): see [docs/data-sources.md](docs/data-sources.md).

Third-party npm dependencies keep their own licences (`package.json` files).
