import React from 'react'
import {
  Dialog as MuiDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  type DialogProps,
} from '@mui/material'
import { Icon } from '../../components/common/Icon'

export interface AuroraDialogProps extends Omit<DialogProps, 'title'> {
  title: React.ReactNode
  onClose: () => void
  actions?: React.ReactNode
  children: React.ReactNode
}

export const AuroraDialog: React.FC<AuroraDialogProps> = ({
  title,
  onClose,
  actions,
  children,
  open,
  ...props
}) => {
  return (
    <MuiDialog
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          className: 'aurora-glass',
          sx: {
            borderRadius: '22px',
            p: 1,
            maxWidth: 540,
            width: '100%',
          },
        },
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(10, 15, 32, 0.65)',
          },
        },
      }}

      {...props}
    >
      <DialogTitle sx={{ m: 0, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>{title}</span>
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
        >
          <Icon name="close" size={16} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider', px: 2.5, py: 2 }}>
        {children}
      </DialogContent>
      {actions && (
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          {actions}
        </DialogActions>
      )}
    </MuiDialog>
  )
}

