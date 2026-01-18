import { Box, type BoxProps } from '@chakra-ui/react'

export const Surface = ({ children, ...props }: BoxProps) => (
  <Box
    bg="tempo.panel"
    borderRadius="16px"
    boxShadow="inset 0 0 0 1px rgba(255,255,255,0.06)"
    {...props}
  >
    {children}
  </Box>
)

export const Inset = ({ children, ...props }: BoxProps) => (
  <Box
    bg="tempo.bg"
    borderRadius="12px"
    boxShadow="inset 0 0 0 1px rgba(255,255,255,0.04)"
    {...props}
  >
    {children}
  </Box>
)
