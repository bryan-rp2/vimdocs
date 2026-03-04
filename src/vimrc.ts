const STORAGE_KEY = 'vimdocs_vimrc';

const DEFAULT_VIMRC = `" VimDocs default .vimrc
set number
set tabstop=4
set shiftwidth=4
set expandtab
set autoindent
set hlsearch
set incsearch
syntax on
set background=dark

" Solarized Dark colorscheme (inline)
highlight Normal       guifg=#839496 guibg=#002b36
highlight CursorLine   guibg=#073642 cterm=NONE
highlight CursorLineNr guifg=#b58900 guibg=#073642
highlight LineNr       guifg=#586e75 guibg=#073642
highlight StatusLine   guifg=#93a1a1 guibg=#073642 gui=bold
highlight StatusLineNC guifg=#586e75 guibg=#073642 gui=NONE
highlight VertSplit    guifg=#073642 guibg=#073642
highlight Visual       guibg=#073642
highlight Search       guifg=#002b36 guibg=#b58900
highlight IncSearch    guifg=#002b36 guibg=#cb4b16
highlight Comment      guifg=#586e75 gui=italic
highlight Constant     guifg=#2aa198
highlight String       guifg=#2aa198
highlight Identifier   guifg=#268bd2
highlight Function     guifg=#268bd2
highlight Statement    guifg=#859900 gui=NONE
highlight PreProc      guifg=#cb4b16
highlight Type         guifg=#b58900 gui=NONE
highlight Special      guifg=#cb4b16
highlight Underlined   guifg=#6c71c4
highlight Error        guifg=#dc322f guibg=#002b36
highlight Todo         guifg=#d33682 guibg=#002b36 gui=bold
highlight Pmenu        guifg=#839496 guibg=#073642
highlight PmenuSel     guifg=#002b36 guibg=#268bd2
highlight MatchParen   guifg=#002b36 guibg=#b58900
highlight NonText      guifg=#073642
highlight SpecialKey   guifg=#073642
highlight Title        guifg=#cb4b16 gui=bold
highlight Directory    guifg=#268bd2
highlight WarningMsg   guifg=#cb4b16
highlight ErrorMsg     guifg=#dc322f guibg=#002b36

" Bridge :w to Google Drive save
autocmd BufWritePost * silent! export
`;

export function getVimrc(): string {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_VIMRC;
}

export function setVimrc(content: string) {
  localStorage.setItem(STORAGE_KEY, content);
}

export function getDefaultVimrc(): string {
  return DEFAULT_VIMRC;
}
