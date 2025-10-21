import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import './index.css'
// import App from './App.jsx'  // V1 - Old workflow
import AppV2 from './AppV2.jsx'  // V2 - New workflow

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChakraProvider>
      <AppV2 />
    </ChakraProvider>
  </StrictMode>,
)
