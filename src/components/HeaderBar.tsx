import {
  Badge,
  Button,
  Divider,
  Flex,
  HStack,
  Link as ChakraLink,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { Wallet } from 'lucide-react'

import BalancesPanel, { type FaucetControls } from './BalancesPanel'
import type { Profile } from '../types'
import type { TempoToken } from '../data/tokens'

type HeaderProps = {
  address: string | null
  shortAddress: string
  isConnected: boolean
  profile: Profile | null
  disabled: boolean
  onSignUp: () => void
  onSignIn: () => void
  onSignOut: () => void
  tokens: TempoToken[]
  faucetControls: FaucetControls
}

const HeaderBar = ({
  address,
  shortAddress,
  isConnected,
  profile,
  disabled,
  onSignUp,
  onSignIn,
  onSignOut,
  tokens,
  faucetControls,
}: HeaderProps) => (
  <Flex
    as="header"
    position="sticky"
    top="0"
    zIndex="10"
    py={4}
    align="center"
    bg="rgba(29,29,29,0.9)"
    backdropFilter="blur(16px)"
  >
    <Flex
      maxW="1200px"
      mx="auto"
      w="100%"
      px={{ base: 6, lg: 8 }}
      align="center"
      justify="space-between"
    >
      <ChakraLink as={RouterLink} to="/" _hover={{ textDecoration: 'none' }}>
        <HStack spacing={2}>
          <Text fontSize="lg" fontWeight="700" fontFamily="mono" color="tempo.accent">
            Cadence
          </Text>
        </HStack>
      </ChakraLink>
      <HStack spacing={6}>
        {profile?.role === 'merchant' && (
          <ChakraLink as={RouterLink} to="/merchant">
            Dashboard
          </ChakraLink>
        )}
      </HStack>
      <HStack spacing={3}>
      {profile && (
        <Badge bg="tempo.panelStrong" color="tempo.text" borderRadius="999px">
          {profile.role}
        </Badge>
      )}
      {isConnected && address ? (
        <>
          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              leftIcon={<Wallet size={16} />}
              variant="outline"
            >
              <Text as="span" fontFamily="mono">
                {shortAddress}
              </Text>
            </MenuButton>
            <MenuList bg="tempo.panel" borderColor="tempo.border" minW="360px">
              <MenuItem
                closeOnSelect={false}
                bg="transparent"
                _hover={{ bg: 'tempo.panelStrong' }}
              >
                <BalancesPanel
                  address={address}
                  title="Balances"
                  subtitle="Your Tempo tokens"
                  tokens={tokens}
                  faucetControls={faucetControls}
                />
              </MenuItem>
              <Divider borderColor="tempo.border" />
              <MenuItem
                onClick={onSignOut}
                _hover={{ bg: 'tempo.panelStrong' }}
              >
                Sign out
              </MenuItem>
            </MenuList>
          </Menu>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={onSignIn} disabled={disabled}>
            Sign in
          </Button>
          <Button size="sm" onClick={onSignUp} disabled={disabled}>
            Create passkey
          </Button>
        </>
      )}
      </HStack>
    </Flex>
  </Flex>
)

export default HeaderBar
