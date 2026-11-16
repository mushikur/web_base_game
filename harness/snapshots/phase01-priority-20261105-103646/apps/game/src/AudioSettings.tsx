import { useEffect, useState } from "react";
import { audioCategories, audioLabels, bn } from "@neta/shared";
import type { StreetAudio } from "./audio";
export function AudioSettings({ audio }: { audio: StreetAudio }) {
  const [, update] = useState(0);
  useEffect(() => audio.subscribe(() => update((n) => n + 1)), [audio]);
  return (
    <fieldset className="audio-settings">
      <legend>শব্দ ও সংগীত</legend>
      <p>পছন্দ এই ডিভাইসে থাকবে। কণ্ঠের ফাইল শব্দের ঘর থেকে প্রকাশ করা যায়।</p>
      {audioCategories.map((category) => {
        const setting = audio.settings[category];
        return (
          <div className="audio-category" key={category}>
            <label htmlFor={"audio-" + category}>
              {audioLabels[category]}
              <small>{bn(setting.volume * 100)}%</small>
            </label>
            <input
              id={"audio-" + category}
              aria-label={audioLabels[category] + " — মাত্রা"}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={setting.volume}
              onChange={(e) =>
                audio.setVolume(category, Number(e.target.value))
              }
            />
            <button
              type="button"
              role="switch"
              aria-checked={!setting.muted}
              aria-label={audioLabels[category] + " চালু"}
              onClick={() => audio.setCategoryMuted(category, !setting.muted)}
            >
              {setting.muted ? "বন্ধ" : "চালু"}
            </button>
            <button
              type="button"
              aria-label={audioLabels[category] + " চ্যানেল পরীক্ষা"}
              onClick={() => void audio.preview(category)}
            >
              শুনুন
            </button>
          </div>
        );
      })}
      <button type="button" onClick={() => void audio.refreshPublished()}>
        প্রকাশিত শব্দের তালিকা হালনাগাদ করুন
      </button>
      {audio.lastError && <p role="status">{audio.lastError}</p>}
    </fieldset>
  );
}
