import { auth } from "@clerk/nextjs/server";
import {
  checkInput,
  stockCardQuerySchema,
  PARTY_TYPE_NAMES,
  type StockCard,
} from "@gasflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/button-styles";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "@/components/load-error";
import { LogoMark } from "@/components/logo-mark";
import { PageHeading } from "@/components/page-heading";
import { NoRecords } from "@/components/report-day";
import { fetchParty, fetchShop, fetchStockCard, orNull } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { partyPath, STOCK_CARD_PATH, stockCardPath } from "@/lib/routes";
import { stockCardSearch } from "@/lib/stock-card-search";
import { CardFilters } from "./card-filters";
import { CardTables } from "./card-tables";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Stock card · GasFlow",
};

export default async function StockCardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await auth.protect();
  const params = await searchParams;
  const asked = checkInput(stockCardQuerySchema, params);
  const query = asked.data;
  const [answer, shop] = await Promise.all([
    query ? orNull(fetchStockCard(query)) : null,
    orNull(fetchShop()),
  ]);
  const card = answer?.card;
  // There is nothing to put on paper or in a file before the records begin.
  const recorded = Boolean(card?.startDate && card.to >= card.startDate);
  // The picker keeps whoever was asked about, even when there is no card to show.
  const party =
    card?.party ??
    (typeof params.partyId === "string" ? await orNull(fetchParty(params.partyId)) : null);

  return (
    <div className="space-y-6">
      {/* A card is wider than it is tall. */}
      <style>{"@page { size: landscape; margin: 12mm; }"}</style>
      <div className="print:hidden">
        <PageHeading
          title="Stock card"
          subtitle={card ? <Described card={card} /> : "One party's cylinders over time."}
        >
          {query && card && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={
                  query.full
                    ? stockCardPath(card.party.id)
                    : `${STOCK_CARD_PATH}?${stockCardSearch({
                        partyId: card.party.id,
                        full: true,
                      })}`
                }
                className={buttonStyles.secondary}
              >
                {query.full ? "This financial year" : "Full history"}
              </Link>
              {recorded && (
                <>
                  {/* A plain link, so that nothing fetches the file before it is asked for. */}
                  <a
                    href={`${STOCK_CARD_PATH}/csv?${stockCardSearch(query)}`}
                    download
                    className={buttonStyles.secondary}
                  >
                    Download CSV
                  </a>
                  <PrintButton />
                </>
              )}
            </div>
          )}
        </PageHeading>
      </div>
      <CardFilters
        key={query ? stockCardSearch(query) : ""}
        party={party ? { id: party.id, name: party.name } : null}
        // Left blank unless asked for, so that a new last date brings its own year.
        from={query?.full ? card?.from : query?.from}
        to={card?.to ?? query?.to}
      />
      {params.partyId === undefined ? (
        <EmptyState>Choose a customer or refiller to see their stock card.</EmptyState>
      ) : asked.problem !== undefined ? (
        <EmptyState>{asked.problem}</EmptyState>
      ) : !answer ? (
        <LoadError>
          The stock card could not be loaded. Check that the API is running, then reload the page.
        </LoadError>
      ) : !answer.card ? (
        <EmptyState>{answer.refusal}</EmptyState>
      ) : (
        <Statement card={answer.card} shopName={shop?.name ?? "GasFlow"} />
      )}
    </div>
  );
}

/** Whose card it is and over which dates. */
function Described({ card: { party, from, to } }: { card: StockCard }) {
  return (
    <>
      <Link href={partyPath(party.id)} className="text-brand-700 wrap-anywhere hover:underline">
        {party.name}
      </Link>{" "}
      · {PARTY_TYPE_NAMES[party.type]} · {formatDate(from)} to {formatDate(to)}
    </>
  );
}

/** The card itself, which is all that is printed, under the shop's name and mark. */
function Statement({ card, shopName }: { card: StockCard; shopName: string }) {
  const { startDate, from, to, party, gases } = card;
  if (!startDate || to < startDate) {
    return <NoRecords startDate={startDate} />;
  }
  return (
    <>
      <header className="hidden space-y-2 print:block">
        <p className="flex items-center gap-2">
          <LogoMark />
          <span className="text-lg font-semibold">{shopName}</span>
        </p>
        <h1 className="text-xl font-semibold">Stock card: {party.name}</h1>
        <p className="text-sm">
          {PARTY_TYPE_NAMES[party.type]} · {formatDate(from)} to {formatDate(to)}
        </p>
      </header>
      {gases.length === 0 ? (
        <EmptyState>
          {party.name} held no cylinders and had none move from {formatDate(from)} to{" "}
          {formatDate(to)}.
        </EmptyState>
      ) : (
        <CardTables card={card} />
      )}
    </>
  );
}
