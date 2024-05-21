import { useCallback, useState } from "react";
import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreVertIcon } from "@mui/icons-material";
import { useListContext } from "../item-list";

type ItemPosition = "first" | "last" | "middle" | "only";

export function DropDownContent({
  position,
  index,
}: {
  position: ItemPosition;
  index: number;
}) {
  const { reorderItem, getListLength } = useListContext();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
