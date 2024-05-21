import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";
import ReactDOM from "react-dom";
import {
  attachClosestEdge,
  Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { Avatar, Box, Chip, Grid, Typography } from "@mui/material";
import { useListContext } from "../item-list";
import { DropDownContent } from "./dropdown-content";

type ItemPosition = "first" | "last" | "middle" | "only";

type Item = {
  id: string;
  label: string;
};

type DraggableState =
  | { type: "idle" }
  | { type: "preview"; container: HTMLElement }
  | { type: "dragging" };

const idleState: DraggableState = { type: "idle" };
const draggingState: DraggableState = { type: "dragging" };

const itemKey = Symbol("item");
type ItemData = {
  [itemKey]: true;
  item: Item;
  index: number;
  instanceId: symbol;
};

function getItemData({
  item,
  index,
  instanceId,
}: {
  item: Item;
  index: number;
  instanceId: symbol;
}): ItemData {
  return {
    [itemKey]: true,
    item,
    index,
    instanceId,
  };
}

function isItemData(data: Record<string | symbol, unknown>): data is ItemData {
  return data[itemKey] === true;
}

export function ListItem({
  item,
  index,
  position,
}: {
  item: Item;
  index: number;
  position: ItemPosition;
}) {
  const { registerItem, instanceId } = useListContext();

  const ref = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  // const dragHandleRef = useRef<HTMLButtonElement>(null);

  const [draggableState, setDraggableState] =
    useState<DraggableState>(idleState);

  useEffect(() => {
    invariant(ref.current);
    // invariant(dragHandleRef.current);

    const element = ref.current;

    const data = getItemData({ item, index, instanceId });

    return combine(
      registerItem({ itemId: item.id, element }),
      draggable({
        element,
        // dragHandle: dragHandleRef.current,
        getInitialData: () => data,
        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({
              x: "16px",
              y: "8px",
            }),
            render({ container }) {
              setDraggableState({ type: "preview", container });

              return () => setDraggableState(draggingState);
            },
          });
        },
        onDragStart() {
          setDraggableState(draggingState);
        },
        onDrop() {
          setDraggableState(idleState);
        },
      }),
      dropTargetForElements({
        element,
        canDrop({ source }) {
          return (
            isItemData(source.data) && source.data.instanceId === instanceId
          );
        },
        getData({ input }) {
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDrag({ self, source }) {
          const isSource = source.element === element;
          if (isSource) {
            setClosestEdge(null);
            return;
          }

          const closestEdge = extractClosestEdge(self.data);

          const sourceIndex = source.data.index;
          invariant(typeof sourceIndex === "number");

          const isItemBeforeSource = index === sourceIndex - 1;
          const isItemAfterSource = index === sourceIndex + 1;

          const isDropIndicatorHidden =
            (isItemBeforeSource && closestEdge === "bottom") ||
            (isItemAfterSource && closestEdge === "top");

          if (isDropIndicatorHidden) {
            setClosestEdge(null);
            return;
          }

          setClosestEdge(closestEdge);
        },
        onDragLeave() {
          setClosestEdge(null);
        },
        onDrop() {
          setClosestEdge(null);
        },
      })
    );
  }, [instanceId, item, index, registerItem]);

  return (
    <>
      <Box
        ref={ref}
        sx={{
          position: "relative",
          backgroundColor: "elevation.surface",
          borderWidth: "border.width.0",
          borderBottomWidth: "1px",
          borderStyle: "solid",
          borderColor: "color.border",
          ":last-of-type": {
            borderWidth: "border.width.0",
          },
        }}
      >
        <Grid
          sx={
            {
              position: "relative",
              padding: "8px",
              ...(draggableState.type === "dragging" && { opacity: 0.4 }),
            }
            /**
             * We are applying the disabled effect to the inner element so that
             * the border and drop indicator are not affected.
             */
          }
        >
          {/* <DragHandleButton
              ref={dragHandleRef}
              label={`Reorder ${item.label}`}
            /> */}
          <DropDownContent position={position} index={index} />
          <Box
            sx={{
              flexGrow: 1,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {item.label}
          </Box>
          <Chip title="1" />
          <Avatar>H</Avatar>
          <Typography>Todo</Typography>
        </Grid>
        {closestEdge && <DropIndicator edge={closestEdge} gap="1px" />}
      </Box>
      {draggableState.type === "preview" &&
        ReactDOM.createPortal(
          <Box
            sx={{
              maxWidth: "360px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.label}
          </Box>,
          draggableState.container
        )}
    </>
  );
}
