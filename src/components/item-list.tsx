import React, {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ReactDOM from "react-dom";
import invariant from "tiny-invariant";

import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import {
  attachClosestEdge,
  Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import {
  Avatar,
  Box,
  Chip,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { MoreVert as MoreVertIcon } from "@mui/icons-material";

type ItemPosition = "first" | "last" | "middle" | "only";

type CleanupFn = () => void;

type ItemEntry = { itemId: string; element: HTMLElement };

type ListContextValue = {
  getListLength: () => number;
  registerItem: (entry: ItemEntry) => CleanupFn;
  reorderItem: (args: {
    startIndex: number;
    indexOfTarget: number;
    closestEdgeOfTarget: Edge | null;
  }) => void;
  instanceId: symbol;
};

const ListContext = createContext<ListContextValue | null>(null);

function useListContext() {
  const listContext = useContext(ListContext);
  invariant(listContext !== null);
  return listContext;
}

type Item = {
  id: string;
  label: string;
};

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

function getItemPosition({
  index,
  items,
}: {
  index: number;
  items: Item[];
}): ItemPosition {
  if (items.length === 1) {
    return "only";
  }

  if (index === 0) {
    return "first";
  }

  if (index === items.length - 1) {
    return "last";
  }

  return "middle";
}

type DraggableState =
  | { type: "idle" }
  | { type: "preview"; container: HTMLElement }
  | { type: "dragging" };

const idleState: DraggableState = { type: "idle" };
const draggingState: DraggableState = { type: "dragging" };

function DropDownContent({
  position,
  index,
}: {
  position: ItemPosition;
  index: number;
}) {
  const { reorderItem, getListLength } = useListContext();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const isMoveUpDisabled = position === "first" || position === "only";
  const isMoveDownDisabled = position === "last" || position === "only";

  const moveToTop = useCallback(() => {
    reorderItem({
      startIndex: index,
      indexOfTarget: 0,
      closestEdgeOfTarget: null,
    });
  }, [index, reorderItem]);

  const moveUp = useCallback(() => {
    reorderItem({
      startIndex: index,
      indexOfTarget: index - 1,
      closestEdgeOfTarget: null,
    });
  }, [index, reorderItem]);

  const moveDown = useCallback(() => {
    reorderItem({
      startIndex: index,
      indexOfTarget: index + 1,
      closestEdgeOfTarget: null,
    });
  }, [index, reorderItem]);

  const moveToBottom = useCallback(() => {
    reorderItem({
      startIndex: index,
      indexOfTarget: getListLength() - 1,
      closestEdgeOfTarget: null,
    });
  }, [index, getListLength, reorderItem]);

  return (
    <>
      <IconButton
        aria-label="more"
        id="long-button"
        aria-controls={open ? "long-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="demo-positioned-menu"
        aria-labelledby="demo-positioned-button"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <MenuItem onClick={moveToTop} disabled={isMoveUpDisabled}>
          Move to top
        </MenuItem>
        <MenuItem onClick={moveUp} disabled={isMoveUpDisabled}>
          Move up
        </MenuItem>
        <MenuItem onClick={moveDown} disabled={isMoveDownDisabled}>
          Move down
        </MenuItem>
        <MenuItem onClick={moveToBottom} disabled={isMoveDownDisabled}>
          Move to bottom
        </MenuItem>
      </Menu>
    </>
  );
}

function ListItem({
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
    <Fragment>
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
    </Fragment>
  );
}

const defaultItems: Item[] = [
  {
    id: "task-1",
    label: "Organize a team-building event",
  },
  {
    id: "task-2",
    label: "Create and maintain office inventory",
  },
  {
    id: "task-3",
    label: "Update company website content",
  },
  {
    id: "task-4",
    label: "Plan and execute marketing campaigns",
  },
  {
    id: "task-5",
    label: "Coordinate employee training sessions",
  },
  {
    id: "task-6",
    label: "Manage facility maintenance",
  },
  {
    id: "task-7",
    label: "Organize customer feedback surveys",
  },
  {
    id: "task-8",
    label: "Coordinate travel arrangements",
  },
];

function getItemRegistry() {
  const registry = new Map<string, HTMLElement>();

  function register({ itemId, element }: ItemEntry) {
    registry.set(itemId, element);

    return function unregister() {
      registry.delete(itemId);
    };
  }

  function getElement(itemId: string): HTMLElement | null {
    return registry.get(itemId) ?? null;
  }

  return { register, getElement };
}

type ListState = {
  items: Item[];
  lastCardMoved: {
    item: Item;
    previousIndex: number;
    currentIndex: number;
    numberOfItems: number;
  } | null;
};

export default function ListExample() {
  const [{ items, lastCardMoved }, setListState] = useState<ListState>({
    items: defaultItems,
    lastCardMoved: null,
  });
  const [registry] = useState(getItemRegistry);

  // Isolated instances of this component from one another
  const [instanceId] = useState(() => Symbol("instance-id"));

  const reorderItem = useCallback(
    ({
      startIndex,
      indexOfTarget,
      closestEdgeOfTarget,
    }: {
      startIndex: number;
      indexOfTarget: number;
      closestEdgeOfTarget: Edge | null;
    }) => {
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        closestEdgeOfTarget,
        indexOfTarget,
        axis: "vertical",
      });

      if (finishIndex === startIndex) {
        // If there would be no change, we skip the update
        return;
      }

      setListState((listState) => {
        const item = listState.items[startIndex];

        return {
          items: reorder({
            list: listState.items,
            startIndex,
            finishIndex,
          }),
          lastCardMoved: {
            item,
            previousIndex: startIndex,
            currentIndex: finishIndex,
            numberOfItems: listState.items.length,
          },
        };
      });
    },
    []
  );

  useEffect(() => {
    return monitorForElements({
      canMonitor({ source }) {
        return isItemData(source.data) && source.data.instanceId === instanceId;
      },
      onDrop({ location, source }) {
        const target = location.current.dropTargets[0];
        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;
        if (!isItemData(sourceData) || !isItemData(targetData)) {
          return;
        }

        const indexOfTarget = items.findIndex(
          (item) => item.id === targetData.item.id
        );
        if (indexOfTarget < 0) {
          return;
        }

        const closestEdgeOfTarget = extractClosestEdge(targetData);

        reorderItem({
          startIndex: sourceData.index,
          indexOfTarget,
          closestEdgeOfTarget,
        });
      },
    });
  }, [instanceId, items, reorderItem]);

  // once a drag is finished, we have some post drop actions to take
  useEffect(() => {
    if (lastCardMoved === null) {
      return;
    }

    const { item } = lastCardMoved;
    const element = registry.getElement(item.id);
    if (element) {
      triggerPostMoveFlash(element);
    }
  }, [lastCardMoved, registry]);

  const getListLength = useCallback(() => items.length, [items.length]);

  const contextValue: ListContextValue = useMemo(() => {
    return {
      registerItem: registry.register,
      reorderItem,
      instanceId,
      getListLength,
    };
  }, [registry.register, reorderItem, instanceId, getListLength]);

  return (
    <ListContext.Provider value={contextValue}>
      <Stack
        sx={{
          maxWidth: "400px",
          borderStyle: "solid",
        }}
      >
        {/*
            It is not expensive for us to pass `index` to items for this example,
            as when reordering, only two items index will ever change.
  
            If insertion or removal where allowed, it would be worth making
            `index` a getter (eg `getIndex()`) to avoid re-rendering many items
          */}
        {items.map((item, index) => (
          <ListItem
            key={item.id}
            item={item}
            index={index}
            position={getItemPosition({ index, items })}
          />
        ))}
      </Stack>
    </ListContext.Provider>
  );
}
