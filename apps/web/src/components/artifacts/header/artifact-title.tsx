import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface ArtifactTitleProps {
  title: string;
  isArtifactSaved: boolean;
  artifactUpdateFailed: boolean;
  onTitleChange?: (title: string) => void;
}

export function ArtifactTitle(props: ArtifactTitleProps) {
  const [draftTitle, setDraftTitle] = useState(props.title);

  useEffect(() => {
    setDraftTitle(props.title);
  }, [props.title]);

  const commitTitle = () => {
    const nextTitle = draftTitle.trim() || "Untitled document";
    setDraftTitle(nextTitle);
    if (nextTitle !== props.title) {
      props.onTitleChange?.(nextTitle);
    }
  };

  return (
    <div className="pl-[6px] pt-3 flex flex-col items-start justify-start ml-[6px] gap-1 max-w-1/2">
      <input
        aria-label="Artifact title"
        className="text-xl font-medium text-gray-600 bg-transparent border-none p-0 outline-none focus:ring-0 max-w-[420px] truncate"
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitTitle();
            event.currentTarget.blur();
          }
        }}
      />
      <span className="mt-auto">
        {props.isArtifactSaved ? (
          <span className="flex items-center justify-start gap-1 text-gray-400">
            <p className="text-xs font-light">Saved</p>
            <CircleCheck className="w-[10px] h-[10px]" />
          </span>
        ) : !props.artifactUpdateFailed ? (
          <span className="flex items-center justify-start gap-1 text-gray-400">
            <p className="text-xs font-light">Saving</p>
            <LoaderCircle className="animate-spin w-[10px] h-[10px]" />
          </span>
        ) : props.artifactUpdateFailed ? (
          <span className="flex items-center justify-start gap-1 text-red-300">
            <p className="text-xs font-light">Failed to save</p>
            <CircleX className="w-[10px] h-[10px]" />
          </span>
        ) : null}
      </span>
    </div>
  );
}
