import { useEffect, useRef, useState } from "react";
import { bn } from "@neta/shared";
import type { NewspaperEdition } from "./newspaper";

export function NewspaperView({
  edition,
  onReplay,
  onHome,
}: {
  edition: NewspaperEdition;
  onReplay(): void;
  onHome(): void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [shareStatus, setShareStatus] = useState("");
  useEffect(() => heading.current?.focus(), []);
  const time = `${bn(Math.floor(edition.elapsed / 60))} মিনিট ${bn(edition.elapsed % 60)} সেকেন্ড`;
  async function copyEdition() {
    const story = [
      edition.name,
      edition.date,
      edition.headline,
      edition.article,
      `পয়েন্ট ${bn(edition.score)} • জনরোষ ${bn(edition.outrage)} • সময় ${time}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(story);
      setShareStatus("প্রতিবেদন কপি হয়েছে।");
    } catch {
      setShareStatus("কপি করা যায়নি। প্রতিবেদনের লেখা বেছে কপি করুন।");
    }
  }
  return (
    <div
      className="newspaper-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-headline"
    >
      <article className="newspaper-edition" lang="bn-BD">
        <div className="news-edition-line">
          <span>কাল্পনিক ঢাকা • বিশেষ সংস্করণ</span>
          <time>{edition.date}</time>
        </div>
        <p className="news-masthead">{edition.name}</p>
        <h1 id="news-headline" ref={heading} tabIndex={-1}>
          {edition.headline}
        </h1>
        <div className="news-story">
          {edition.image && (
            <figure>
              <img
                src={edition.image}
                alt="খেলার দৃশ্য থেকে তোলা অভিযানের ছবি"
              />
              <figcaption>খেলার ক্যামেরায় ধরা অভিযানের দৃশ্য</figcaption>
            </figure>
          )}
          <div>
            <p>{edition.article}</p>
            <blockquote>
              “{edition.quote}”<cite> — পাড়ার এক বাসিন্দা</cite>
            </blockquote>
            <p className="news-title">সজল পথিক • {edition.title}</p>
          </div>
        </div>
        <dl className="news-facts">
          <div>
            <dt>খোলা এলাকা</dt>
            <dd>{bn(edition.areas.length)}</dd>
          </div>
          <div>
            <dt>মোট পয়েন্ট</dt>
            <dd>{bn(edition.score)}</dd>
          </div>
          <div>
            <dt>সেরা কম্বো</dt>
            <dd>{bn(edition.bestCombo)}</dd>
          </div>
          <div>
            <dt>জনরোষ</dt>
            <dd>{bn(edition.outrage)}%</dd>
          </div>
          <div>
            <dt>প্রমাণের ছবি</dt>
            <dd>{bn(edition.evidence.length)}</dd>
          </div>
          <div>
            <dt>খেলার সময়</dt>
            <dd>{time}</dd>
          </div>
        </dl>
        <p>
          <strong>ব্যবহার করেছেন </strong>
          {edition.used.length
            ? edition.used
                .map((item) => `${item.label} ${bn(item.count)} বার`)
                .join(" • ")
            : "এই সংরক্ষিত খেলায় ব্যবহারের তথ্য নেই।"}
        </p>
        {edition.evidence.length > 0 && (
          <p>
            <strong>ছবি জমা হয়েছে </strong>
            {edition.evidence.join(" • ")}
          </p>
        )}
        <footer className="news-actions">
          <button className="primary" onClick={onReplay}>
            আবার খেলুন
          </button>
          <button className="secondary" onClick={copyEdition}>
            প্রতিবেদন কপি করুন
          </button>
          <button className="secondary" onClick={onHome}>
            প্রচ্ছদে ফিরুন
          </button>
        </footer>
        {shareStatus && <p role="status">{shareStatus}</p>}
      </article>
    </div>
  );
}
