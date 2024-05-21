import {
  createContext,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Box } from "@mui/material";
import { type Theme } from "@mui/material/styles";

import invariant from "tiny-invariant";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import battery from "@atlaskit/pragmatic-drag-and-drop-docs/examples/icons/battery.png";
import drill from "@atlaskit/pragmatic-drag-and-drop-docs/examples/icons/drill.png";
import koala from "@atlaskit/pragmatic-drag-and-drop-docs/examples/icons/koala.png";
import ui from "@atlaskit/pragmatic-drag-and-drop-docs/examples/icons/ui.png";
import wallet from "@atlaskit/pragmatic-drag-and-drop-docs/examples/icons/wallet.png";
import yeti from "@atlaskit/pragmatic-drag-and-drop-docs/examples/icons/yeti.png";

function getInstanceId() {
  return Symbol("instance-id");
}

const InstanceIdContext = createContext<symbol | null>(null);

const itemStyles = (theme: Theme) => ({
  objectFit: "cover",
  width: "100%",
  boxSizing: "border-box",
  cursor: "pointer",
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  transition: `all ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeInOut}`,
});

const itemStateStyles = (theme: Theme) => ({
  idle: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      boxShadow: theme.shadows[4],
    },
  },
  dragging: {
    filter: "grayscale(0.8)",
  },
  over: {
    transform: "scale(1.1) rotate(8deg)",
    filter: "brightness(1.15)",
    boxShadow: theme.shadows[6],
  },
});

type State = "idle" | "dragging" | "over";

const Item = memo(function Item({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [state, setState] = useState<State>("idle");

  const instanceId = useContext(InstanceIdContext);

  useEffect(() => {
    const el = ref.current;
    invariant(el);

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: "grid-item", src, instanceId }),
        onDragStart: () => setState("dragging"),
        onDrop: () => setState("idle"),
      }),
      dropTargetForElements({
        element: el,
        getData: () => ({ src }),
        getIsSticky: () => true,
        canDrop: ({ source }) =>
          source.data.instanceId === instanceId &&
          source.data.type === "grid-item" &&
          source.data.src !== src,
        onDragEnter: () => setState("over"),
        onDragLeave: () => setState("idle"),
        onDrop: () => setState("idle"),
      })
    );
  }, [instanceId, src]);

  return (
    <Box
      component="img"
      ref={ref}
      src={src}
      sx={(theme) => ({
        ...itemStyles(theme),
        ...itemStateStyles(theme)[state],
      })}
    />
  );
});

export function GridItem() {
  const [items, setItems] = useState<string[]>(() => [
    battery,
    drill,
    koala,
    ui,
    wallet,
    yeti,
  ]);

  const [instanceId] = useState(getInstanceId); // returns a new unique symbol value

  useEffect(() => {
    return monitorForElements({
      canMonitor({ source }) {
        return source.data.instanceId === instanceId;
      },
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];
        if (!destination) {
          return;
        }
        const destinationSrc = destination.data.src;
        const startSrc = source.data.src;

        if (typeof destinationSrc !== "string") {
          return;
        }

        if (typeof startSrc !== "string") {
          return;
        }

        // swapping item positions
        const updated = [...items];
        updated[items.indexOf(startSrc)] = destinationSrc;
        updated[items.indexOf(destinationSrc)] = startSrc;

        setItems(updated);
      },
    });
  }, [instanceId, items]);

  return (
    <InstanceIdContext.Provider value={instanceId}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 120px)",
          gap: "16px",
        }}
      >
        {items.map((src) => (
          <Item src={src} key={src} />
        ))}
      </Box>
    </InstanceIdContext.Provider>
  );
}
