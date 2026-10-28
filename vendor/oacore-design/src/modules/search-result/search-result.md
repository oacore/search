### Loading state

```js
<SearchResult id="example-01" aria-busy="true"></SearchResult>
```

### Regular state

```js
<SearchResult
  aria-busy="true"
  id="example-02"
  data={{
    title: 'Towards effective research recommender systems for repositories',
    author: [
      { name: 'Petr Knoth' },
      { name: 'Lucas Anastasiou' },
      { name: 'Aristotelis Charalampous' },
      { name: 'Matteo Cancellieri' },
      { name: 'Samuel Pearce' },
      { name: 'Nancy Pontika' },
      { name: 'Vaclav Bayer' },
    ],
    publicationDate: '2017',
    fieldOfStudy: 'Computer science',
    thumbnailUrl: '//core.ac.uk/image/82984538/medium',
    metadataLink: '//core.ac.uk/display/82984538',
    fullTextLink: '//core.ac.uk/reader/82984538',
    dataProviders: [
      {
        id: 1,
        name: 'Aberdeen University Research Archive',
        downloadUrl: '//core.ac.uk/data-providers/1',
      },
      {
        id: 86,
        name: 'Open Research Online',
        downloadUrl: '//core.ac.uk/data-providers/86',
      },
    ],
  }}
>
  In this paper, we argue why and how the integration of recommender systems for
  research can enhance the functionality and user experience in repositories. We
  present the latest technical innovations in the CORE Recommender, which
  provides research article recommendations across the global network of
  repositories and journals. The CORE Recommender has been recently redeveloped
  and released into production in the CORE system and has also been deployed in
  several third-party repositories. We explain the design choices of this unique
  system and the evaluation processes we have in place to continue raising the
  quality of the provided recommendations. By drawing on our experience, we
  discuss the main challenges in offering a state-of-the-art recommender
  solution for repositories. We highlight two of the key limitations of the
  current repository infrastructure with respect to developing research
  recommender systems: 1) the lack of a standardised protocol and capabilities
  for exposing anonymised user-interaction logs, which represent critically
  important input data for recommender systems based on collaborative filtering
  and 2) the lack of a voluntary global sign-on capability in repositories,
  which would enable the creation of personalised recommendation and
  notification solutions based on past user interactions
</SearchResult>
```
