"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Hash, FileText, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col flex-1">
      <h1 className="text-2xl font-bold text-deep mb-6">{t("title")}</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-deep/40" />
        <Input
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-10"
        />
      </div>

        {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Hash className="w-12 h-12 text-deep/20 mx-auto mb-4" />
          <p className="text-deep/50 text-lg">
            {search ? t("noChannelsQuery") : t("noChannels")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>

          {cursor && (
            <div className="text-center mt-8">
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
  );
}