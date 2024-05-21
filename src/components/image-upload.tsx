import { memo, useCallback, useEffect, useRef, useState } from "react";

import { bind } from "bind-event-listener";
import invariant from "tiny-invariant";

import { Image as ImageIcon } from "@mui/icons-material";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  dropTargetForExternal,
  monitorForExternal,
} from "@atlaskit/pragmatic-drag-and-drop/external/adapter";
import {
  containsFiles,
  getFiles,
} from "@atlaskit/pragmatic-drag-and-drop/external/file";
import { preventUnhandled } from "@atlaskit/pragmatic-drag-and-drop/prevent-unhandled";
import { Box, Button } from "@mui/material";

type UserUpload = {
  type: "image";
  dataUrl: string;
  name: string;
  size: number;
};

const Upload = memo(function Upload({ upload }: { upload: UserUpload }) {
  const [state, setState] = useState<"loading" | "ready">("loading");
  const clearTimeout = useRef<() => void>(() => {});

  useEffect(function mount() {
    return function unmount() {
      clearTimeout.current();
    };
  }, []);

  return (
    <Box
      sx={{
        // overflow: 'hidden',
        position: "relative",
        // using these to hide the details
        borderRadius: "8px",
        overflow: "hidden",
        transition: `opacity 300ms ease-in-out, filter 300ms ease-in-out`,
        ...(state === "loading"
          ? {
              opacity: "0",
              filter: "blur(1.5rem)",
            }
          : { opacity: "1", filter: "blur(0)" }),
      }}
    >
      <Box
        component="img"
        src={upload.dataUrl}
        sx={{
          display: "block",
          // borrowing values from pinterest
          // ratio: 0.6378378378
          width: "216px",
          height: "340px",
          objectFit: "cover",
        }}
        onLoad={() => {
          // this is the _only_ way I could find to get the animation to run
          // correctly every time in all browsers
          // setTimeout(fn, 0) -> sometimes wouldn't work in chrome (event nesting two)
          // requestAnimationFrame -> nope (event nesting two)
          // requestIdleCallback -> nope (doesn't work in safari)
          // I can find no reliable hook for applying the `ready` state,
          // this is the best I could manage 😩
          const timerId = setTimeout(() => setState("ready"), 100);
          clearTimeout.current = () => window.clearTimeout(timerId);
        }}
      />
      <Box
        sx={{
          display: "flex",
          boxSizing: "border-box",
          width: "100%",
          padding: "8px",
          position: "absolute",
          bottom: 0,
          gap: "16px",
          flexDirection: "row",
          backgroundColor: "rgba(255,255,255,0.5)",
        }}
      >
        <Box
          component="em"
          sx={{
            flexGrow: "1",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {upload.name}
        </Box>
        <code>{Math.round(upload.size / 1000)}kB</code>
      </Box>
    </Box>
  );
});

const Gallery = memo(function Gallery({
  uploads: uploads,
}: {
  uploads: UserUpload[];
}) {
  if (!uploads.length) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        width: "70vw",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      {uploads.map((upload, index) => (
        <Upload upload={upload} key={index} />
      ))}
    </Box>
  );
});

export function Uploader() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"idle" | "potential" | "over">("idle");
  const [uploads, setUploads] = useState<UserUpload[]>([]);

  /**
   * Creating a stable reference so that we can use it in our unmount effect.
   *
   * If we used uploads as a dependency in the second `useEffect` it would run
   * every time the uploads changed, which is not desirable.
   */
  const stableUploadsRef = useRef<UserUpload[]>(uploads);
  useEffect(() => {
    stableUploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => {
    return () => {
      /**
       * MDN recommends explicitly releasing the object URLs when possible,
       * instead of relying just on the browser's garbage collection.
       */
      stableUploadsRef.current.forEach((upload) => {
        URL.revokeObjectURL(upload.dataUrl);
      });
    };
  }, []);

  const addUpload = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      return;
    }

    const upload: UserUpload = {
      type: "image",
      dataUrl: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    };
    setUploads((current) => [...current, upload]);
  }, []);

  const onFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      files.forEach(addUpload);
    },
    [addUpload]
  );

  useEffect(() => {
    const el = ref.current;
    invariant(el);
    return combine(
      dropTargetForExternal({
        element: el,
        canDrop: containsFiles,
        onDragEnter: () => setState("over"),
        onDragLeave: () => setState("potential"),
        onDrop: async ({ source }) => {
          const files = await getFiles({ source });

          files.forEach((file) => {
            if (file == null) {
              return;
            }
            if (!file.type.startsWith("image/")) {
              return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);

            // for simplicity:
            // - not handling errors
            // - not aborting the
            // - not unbinding the event listener when the effect is removed
            bind(reader, {
              type: "load",
              listener(event) {
                const result = reader.result;
                if (typeof result === "string") {
                  const upload: UserUpload = {
                    type: "image",
                    dataUrl: result,
                    name: file.name,
                    size: file.size,
                  };
                  setUploads((current) => [...current, upload]);
                }
              },
            });
          });
        },
      }),
      monitorForExternal({
        canMonitor: containsFiles,
        onDragStart: () => {
          setState("potential");
          preventUnhandled.start();
        },
        onDrop: () => {
          setState("idle");
          preventUnhandled.stop();
        },
      })
    );
  });

  /**
   * We trigger the file input manually when clicking the button. This also
   * works when selecting the button using a keyboard.
   *
   * We do this for two reasons:
   *
   * 1. Styling file inputs is very limited.
   * 2. Associating the button as a label for the input only gives us pointer
   *    support, but does not work for keyboard.
   */
  const inputRef = useRef<HTMLInputElement>(null);
  const onInputTriggerClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexDirection: "column",
      }}
    >
      <Box
        ref={ref}
        data-testid="drop-target"
        sx={{
          display: "flex",
          flexDirection: "column",
          padding: "8px",
          boxSizing: "border-box",
          alignItems: "center",
          justifyContent: "center",
          background: "#091E4208",
          borderRadius: "8px",
          transition: `all 300ms ease-in-out`,
          border: "2px dashed transparent",
          width: "100%",
          gap: "24px",
          ...(state === "over"
            ? {
                background: "#CCE0FF",
                color: "#0C66E4",
                borderColor: "#0C66E4",
              }
            : state === "potential"
            ? {
                borderColor: "#0C66E4",
              }
            : undefined),
        }}
      >
        <Box
          component="strong"
          sx={{
            color: "#091E424F",
            fontSize: "1.4rem",
          }}
        >
          Drop some images on me! <ImageIcon />
        </Box>

        <Button onClick={onInputTriggerClick}>Select images</Button>

        <Box
          component="input"
          ref={inputRef}
          sx={{
            display: "none",
          }}
          id="file-input"
          onChange={onFileInputChange}
          type="file"
          accept="image/*"
          multiple
        />
      </Box>
      <Gallery uploads={uploads} />
    </Box>
  );
}
