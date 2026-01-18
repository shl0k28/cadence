import { Box, Text } from '@chakra-ui/react'

import type { TempoToken } from '../data/tokens'

type TokenLogoProps = {
  token?: Pick<TempoToken, 'symbol' | 'logoUri'>
  boxSize?: string | number
}

const TokenLogo = ({ token, boxSize = '36px' }: TokenLogoProps) => (
  <Box
    boxSize={boxSize}
    borderRadius="full"
    overflow="hidden"
    bg="tempo.panelStrong"
    display="grid"
    placeItems="center"
  >
    {token?.logoUri ? (
      <Box
        as="img"
        src={token.logoUri}
        alt={`${token?.symbol ?? 'Token'} logo`}
        width="100%"
        height="100%"
        objectFit="contain"
      />
    ) : (
      <Text fontSize="xs" color="tempo.muted">
        {(token?.symbol ?? '?').slice(0, 2)}
      </Text>
    )}
  </Box>
)

export default TokenLogo
