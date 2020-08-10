import React from 'react'
import { Button } from '@oacore/design'

import styles from './styles.module.css'
import DataProvidersSelect from './search'

import Search from 'modules/search-layout'

const DataProvidersSearchTemplate = () => (
  <Search className={styles.searchArea}>
    <DataProvidersSelect />
    <Search.ResultStats from={1} to={10} total={9934} />
    <Search.Results>
      <Search.Result>Result 1</Search.Result>
      <Search.Result>Result 2</Search.Result>
      <Search.Result>Result 3</Search.Result>
      <Search.Result>Result 4</Search.Result>
    </Search.Results>
    <Search.Content>
      <p>
        We aggregate research papers from data providers all over the world
        including institutional and subject repositories and journal publishers.
        This process, which is also called harvesting, allows us to offer
        search, text mining and analytical capabilities over not only metadata,
        but also the full text of the research papers making CORE a unique
        service in the research community. Our dataset currently contains
        182,918,912 open access articles, from over tons of thousands journals,
        collected from over 9,972 repositories and journals around the world.
      </p>
      <Button variant="outlined">Become data provider</Button>
    </Search.Content>
    <Search.Footer>
      <Button variant="contained">Add data provider</Button>
    </Search.Footer>
  </Search>
)
export default DataProvidersSearchTemplate
