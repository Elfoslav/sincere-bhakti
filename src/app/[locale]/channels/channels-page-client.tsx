"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Hash, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SearchInput from "@/components/SearchInput";
import type { ChannelInfo } from "@/types/user";

interface ChannelsResponse {
  items: ChannelInfo[];
  nextCursor: string | null;
}

export default function ChannelsPageClient() {
  const t = useTranslations("ChannelsPage");
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchChannels = useCallback(async (q: string, c?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (c) params.set("cursor", c);
    const res = await fetch(`/api/channels?${params}`);
    if (!res.ok) return null;
    return res.json() as Promise<ChannelsResponse>;
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchChannels(search).then((data) => {
      if (mounted && data) {
        setChannels(data.items);
        setCursor(data.nextCursor);
      }
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [search, fetchChannels]);

  function handleSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim());
    }, 300);
  }

  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchChannels(search, cursor);
    if (data) {
      setChannels((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-8 flex flex-col flex-1">
      <h1 className="text-xl sm:text-2xl font-bold text-deep mb-4 sm:mb-6">{t("title")}</h1>

      <SearchInput
        value={query}
        onChange={handleSearchChange}
        placeholder={t("searchPlaceholder")}
        loading={loading}
        className="mb-6"
      />

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 flex-1 auto-rows-min">
        {loading ? (
          <>
            <Skeleton className="h-20 sm:h-24 rounded-lg" />
            <Skeleton className="h-20 sm:h-24 rounded-lg" />
            <Skeleton className="h-20 sm:h-24 rounded-lg hidden sm:block" />
            <Skeleton className="h-20 sm:h-24 rounded-lg hidden sm:block" />
          </>
      ) : channels.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <Hash className="w-10 h-10 sm:w-12 sm:h-12 text-deep/20 mx-auto mb-4" />
            <p className="text-deep/50 text-base sm:text-lg">
              {search ? t("noChannelsQuery") : t("noChannels")}
            </p>
          </div>
      ) : (
        <>
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/channels/${ch.slug}`}
              className="block bg-white hover:bg-sand/30 active:bg-sand/50 rounded-lg border border-sand p-4 transition-colors"
            >
              <div className="flex items-center gap-3">
                {ch.avatarUrl ? (
                  <img
                    src={ch.avatarUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                    <Hash className="w-6 h-6 text-gold" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-deep truncate">{ch.name}</p>
                  <p className="text-xs text-deep/50 flex items-center gap-1 mt-0.5">
                    <FileText className="w-3 h-3" />
                    {t("postCount", { count: ch.postCount })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          {cursor && (
            <div className="col-span-full text-center mt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? t("loading") : t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}